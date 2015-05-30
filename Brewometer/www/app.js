// JavaScript code for the BLE Scan example app.

// Application object.
var app = {};



// Device list.
app.discoveredDevices = {};

app.connectedDevices = {};

// UI methods.
app.ui = {};

app.logString = "";

// Timer that updates the device list and removes inactive
// devices in case no devices are found by scan.
app.ui.updateTimer = null;

app.UUID_BEANSERVICE = 'F000FFC0-0451-4000-B000-000000000000';

app.beanAppMessageServiceUUID = 'a495ff10-c5b1-4b44-b512-1370f02d74de';
app.beanAppMessageCharacteristicUUID = 'a495ff11-c5b1-4b44-b512-1370f02d74de';

app.UUID_SCRATCHSERVICE = 'a495ff20-c5b1-4b44-b512-1370f02d74de'.toUpperCase();
app.getScratchCharacteristicUUID = function(scratchNumber) {
	return ['a495ff21-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
		'a495ff22-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
		'a495ff23-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
		'a495ff24-c5b1-4b44-b512-1370f02d74de'.toUpperCase(),
		'a495ff25-c5b1-4b44-b512-1370f02d74de'.toUpperCase()
	][scratchNumber - 1];
};


// document.addEventListener('pause', this.pause, false);

// function pause(){
// 	console.log('pause, disconnecting devices');
// 	for (var item in app.connectedDevices) {
// 		ble.disconnect(app.connectedDevices[item]);
// 	}

// }


document.addEventListener('deviceready', this.onDeviceReady, false);

function onDeviceReady() {
	console.log('onDeviceReady');

	if (cordova.file) {
		app.newLogfile();
		app.logTimer = setInterval(function() {
			writeLogToFile()
		}, 500);

	} else {
		console.log('cordova.file plugin not found, no logging')
	}
}


app.newLogfile = function() {
	var directoryURL = '';
	if (device.platform.toUpperCase() === 'ANDROID') {
		directoryURL = cordova.file.externalApplicationStorageDirectory;
	} else if (device.platform.toUpperCase() === 'IOS') {
		directoryURL = cordova.file.documentsDirectory;
	}

	window.resolveLocalFileSystemURL(directoryURL, function(dir) {
		console.log("external storage dir: " + dir.name);
		var dateString = new Date(Date.now()).toISOString().substring(0, 19).replace('T', '-').replace(':', '-').replace(':', '-');
		dir.getFile('SENtrode' + dateString + '.csv', {
			create: true
		}, function(file) {
			console.log("opened file: " + file.name);
			app.logfile = file;

			app.logfile.createWriter(function(fileWriter) {
				app.fileWriter = fileWriter;
				var header = 'Timestamp,peripheral,id,GATT,heartrate,ax,ay,az';
				header += ',aTimestamp';
				header += ',SLOTA_PD1';
				header += ',SLOTA_PD2';
				header += ',SLOTA_PD3';
				header += ',SLOTA_PD4';
				header += ',rawTimestamp';
				header += ',led';
				header += ',SLOTB_PD1';
				header += ',SLOTB_PD2';
				header += ',SLOTB_PD3';
				header += ',SLOTB_PD4';
				header += ',rawTimestamp';
				header += ',rawPulse';
				header += ',firmware';
				app.writeLog(header + '\n');
			});
		});
	});
}


function writeLogToFile() {
	if ((app.logString == "") || (!app.fileWriter)) return;
	var blob = new Blob([app.logString], {
		type: 'text/plain'
	});
	app.fileWriter.seek(app.fileWriter.length);
	app.fileWriter.write(blob);
	//console.log(app.logString);
	app.logString = "";
}

app.writeLog = function(str) {
	if (!app.fileWriter) return;
	app.logString += str;
}


app.hexStringFromUint8Array = function(data){
	var hexString = '';
	for (var i = 0; i < data.length; i++) {
		hexString += evothings.util.toHexString(data[i], 1);
	}
	return hexString;
}

app.startScan = function(callbackFun) {
	//bean doesn't advertise data services, filter on name?
	ble.scan([], 60,
		function(device) {
			// Report success. Sometimes an RSSI of +127 is reported.
			// We filter out these values here.
			if (device.rssi <= 0) {
				callbackFun(device, null);
			}
		},
		function(errorCode) {
			// Report error.
			callbackFun(null, errorCode);
		});
};


// Called when Start Scan button is selected.
app.ui.onStartScanButton = function() {
	app.discoveredDevices = {};
	app.startScan(app.ui.deviceFound);
	app.ui.displayStatus('Scanning...');
	app.ui.updateTimer = setInterval(app.ui.displayDeviceList, 500);
};


// Called when a device is found.
app.ui.deviceFound = function(device, errorCode) {
	if (device) {
		// Set timestamp for device (this is used to remove
		// inactive devices).
		device.timeStamp = Date.now();

		// Insert the device into table of found devices.
		app.discoveredDevices[device.id] = device;
	} else if (errorCode) {
		app.ui.displayStatus('Scan Error: ' + errorCode);
	}
};

app.parseHeartrate = function(peripheral, data) {
	dataUint8Array = new Uint8Array(data);
	var logString = Date.now() + ',' + peripheral.name + ',' + peripheral.id;
	var hexString = '';
	for (var i = 0; i < 2; i++) {
		hexString += evothings.util.toHexString(dataUint8Array[i], 1);
	}
	logString += ',' + hexString;

	logString += ',' + evothings.util.littleEndianToUint8(dataUint8Array, 1);

	for (var i = 0; i < 17; i++) {
		logString += ',';
	}

	app.writeLog(logString + '\n');
}

app.onConnect = function(peripheral) {
	app.ui.displayStatus("Connected to " + peripheral.id);
	peripheral.timestamp = Date.now();
	app.connectedDevices[peripheral.id] = peripheral;

	//listen on scratch 2
	console.log('enabling notifications on scratch 2');
	ble.startNotification(peripheral.id, app.UUID_SCRATCHSERVICE, app.getScratchCharacteristicUUID(2),
		function(data) {
			app.parseBrewometerData(peripheral, data, function(brewometerData) {
				//app.postBrewometerData(brewometerData);
			});
		},
		function(errorcode) {
			console.log('BLE startNotification error: ' + errorCode);
		});

	//listen on scratch
	console.log('enabling notifications on beanAppMessageCharacteristicUUID');
	ble.startNotification(peripheral.id, app.beanAppMessageServiceUUID, app.beanAppMessageCharacteristicUUID,
		function(data) {
			console.log('notification ' + app.beanAppMessageCharacteristicUUID);
			console.log(data);
		},
		function(errorcode) {
			console.log('BLE startNotification error: ' + errorCode);
		});
}

//Generated by `./pycrc.py --algorithm=table-driven --model=ccitt --generate=c`
app.crcTable = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
  0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef,
  0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6,
  0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de,
  0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485,
  0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d,
  0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4,
  0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc,
  0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b,
  0x5af5, 0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12,
  0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a,
  0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41,
  0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49,
  0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70,
  0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78,
  0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f,
  0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e,
  0x02b1, 0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256,
  0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
  0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
  0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e, 0xc71d, 0xd73c,
  0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634,
  0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab,
  0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3,
  0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
  0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92,
  0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9,
  0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1,
  0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8,
  0x6e17, 0x7e36, 0x4e55, 0x5e74, 0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
];

app.crc = function crc(data)
{
  var crc = 0xffff;

  for (var i = 0, l = data.length; i < l; ++i)
  {
  	crc = (app.crcTable[((crc >> 8) ^ data[i]) & 0xff] ^ (crc << 8)) & 0xffff;
  }
  crc_16 = new Uint16Array(1);
  crc_16[0] = crc;
  crc_8 = new Uint8Array(crc_16.buffer);

  return crc_8;
}

app.getBeanMessage = function getBuffer(cmdBuffer,payloadBuffer){

    //size buffer contains size of(cmdBuffer, and payloadBuffer) and a reserved byte set to 0
    var sizeBuffer = new Uint8Array(2);
    sizeBuffer[0] = cmdBuffer.length + payloadBuffer.length;

    //GST (Gatt Serial Transport) contains sizeBuffer, cmdBuffer, and payloadBuffer
    var gstBuffer = new Uint8Array(sizeBuffer.length + cmdBuffer.length + payloadBuffer.length);
    gstBuffer.set(sizeBuffer,0);
    gstBuffer.set(cmdBuffer,sizeBuffer.length);
    gstBuffer.set(payloadBuffer,sizeBuffer.length+cmdBuffer.length);

    var crc16Buffer = app.crc(gstBuffer);

    //GATT contains sequence header, gstBuffer and crc166
    var gattBuffer = new Uint8Array(1 + gstBuffer.length + crc16Buffer.length);

    var header = (((this.count++ * 0x20) | 0x80) & 0xff);
    gattBuffer[0]=header;

    gattBuffer.set(gstBuffer,1); //copy gstBuffer into gatt shifted right 1

    //swap 2 crc bytes and add to end of gatt
    gattBuffer[gattBuffer.length-2]=crc16Buffer[0];
    gattBuffer[gattBuffer.length-1]=crc16Buffer[1];
    
    //console.log(gattBuffer);

    return gattBuffer;
}

app.onDisconnect = function(reason) {
	alert("Device disconnected, " + reason);
	app.ui.displayStatus("Disconnected");
}

app.connectToDevice = function(address) {
	if (address in app.discoveredDevices) {
		var device = app.discoveredDevices[address];

		ble.connect(device.id, app.onConnect, app.onDisconnect);
	} else {
		console.log(address + ' no longer in discoveredDevices');
	}
};

app.setBeanLed = function(device,r,g,b){
	var payload = new Uint8Array(3);
	payload[0] = r;
	payload[1] = g;
	payload[2] = b;

	app.sendBeanAppMessage(devices,0x20,0x01,payload);
}

app.sendBeanAppMessage = function(device,major,minor,payload) {

	var cmdBuffer  = new Uint8Array(2);
	cmdBuffer[0] = major; 
	cmdBuffer[1] = minor;

	var data = app.getBeanMessage(cmdBuffer,payload);

	ble.write(device.id, app.beanAppMessageServiceUUID, app.beanAppMessageCharacteristicUUID, data.buffer, function(){
		console.log('wrote ' + app.beanAppMessageCharacteristicUUID + ' with data: ' +  app.hexStringFromUint8Array(data));
	}, function(e){
		console.log('failed to write to ' + app.beanAppMessageCharacteristicUUID + ", " + e);
	})

}


// Display the device list.
app.ui.displayDeviceList = function() {
	var timeNow = Date.now();

	var connectedDevicesList = document.getElementById("connected-devices");
	connectedDevicesList.innerHTML = ""; //clear list

	for (var item in app.connectedDevices) {
		var device = app.connectedDevices[item];
		// Only show devices that are connected
		// create a <li> for each one.
		var listItem = document.createElement("li");

		var name = document.createElement("strong");
		name.innerHTML = device.name;
		listItem.appendChild(name);


		listItem.innerHTML += '<br />';

		listItem.innerHTML += String(device.heartrate) + " BPM"
		listItem.innerHTML += '<br />';

		//Led
		device.ledButton = document.createElement("button");
		device.ledButton.className = "red";
		device.ledButton.innerHTML = "LED  " + device.id;
		device.ledButton.id = device.id;
		device.ledButton.onclick = function() {
			console.log("ledButton click " + this.id);
			//app.setBeanLed(device,0x00,0xff,0x00);

		};
		listItem.appendChild(device.ledButton);

		listItem.innerHTML += '<br />';

		//disconnect
		device.disconnectButton = document.createElement("button");
		device.disconnectButton.className = "red";
		device.disconnectButton.innerHTML = "Disconnect";
		device.disconnectButton.id = device.id;
		device.disconnectButton.onclick = function() {
			console.log("disconnectButton click " + this.id);
			ble.disconnect(this.id);
			delete(app.connectedDevices[this.id]);
		};
		listItem.appendChild(device.disconnectButton);

		// add listItem to the listElement
		connectedDevicesList.appendChild(listItem);

	}


	var listElement = document.getElementById("found-devices");
	listElement.innerHTML = ""; //clear list

	for (var item in app.discoveredDevices) {
		var discoveredDevice = app.discoveredDevices[item];
		if ((!(item in app.connectedDevices)) && (discoveredDevice.timeStamp + 60000 > timeNow)) {
			// create a <li> for each one.
			var listItem = document.createElement("li");

			var name = document.createElement("strong");
			name.innerHTML = discoveredDevice.name;
			listItem.appendChild(name);

			listItem.innerHTML += '<br />';
			listItem.innerHTML += discoveredDevice.id + '<br />';
			listItem.innerHTML += discoveredDevice.rssi + '<br />';

			var rssiWidth = 1; // Used when RSSI is zero or greater.
			if (discoveredDevice.rssi < -100) {
				rssiWidth = 100;
			} else if (discoveredDevice.rssi < 0) {
				rssiWidth = 100 + discoveredDevice.rssi;
			}

			var rssiSlider = document.createElement("div");
			rssiSlider.style.background = 'rgb(225,0,0)';
			rssiSlider.style.width = rssiWidth + 'px';
			rssiSlider.style.height = '20px';
			listItem.appendChild(rssiSlider);

			discoveredDevice.connectButton = document.createElement("button");
			discoveredDevice.connectButton.className = "red";
			discoveredDevice.connectButton.innerHTML = "Connect";
			discoveredDevice.connectButton.id = discoveredDevice.id;
			discoveredDevice.connectButton.onclick = function() {
				console.log("connectButton click, " + this.id);
				app.connectToDevice(this.id);
			};
			discoveredDevice.connectButton.innerHTML = "Connect";


			listItem.appendChild(discoveredDevice.connectButton);


			// add listItem to the listElement
			listElement.appendChild(listItem);
		}

	}

};

app.parseBrewometerData = function(peripheral, data, success) {
	var acc = new Int16Array(data, 0, 3);
	var temperature = (new Uint8Array(data, 6, 1))[0];
	var batteryLevel = (new Uint8Array(data, 7, 1))[0];

	var timestamp = (new Int32Array(data, 8, 1))[0];

	console.log('acc read: ' + acc[0] + ',' + acc[1] + ',' + acc[2]);
	console.log('Temperature read: ' + temperature);
	console.log('batteryLevel read: ' + batteryLevel);
	console.log('timestamp read: ' + timestamp);

	pitch = -Math.atan(-acc[1] / Math.sqrt(acc[0] * acc[0] + acc[2] * acc[2])) * 180 / Math.PI;

	movingAverage.newValue(pitch);
	pitchAverage = movingAverage.getAverage();

	peripheral.brewometerData.x = acc[0];
	peripheral.brewometerData.y = acc[1];
	peripheral.brewometerData.z = acc[2];
	//brewometer timestamps are in s from 1970, database in s from 2001
	peripheral.brewometerData.t = timestamp - 978307200;
	peripheral.brewometerData.temp = temperature;
	peripheral.brewometerData.battery = (batteryLevel / 100.0) * (3.53 - 1.95) + 1.95;
	peripheral.brewometerData.sensorId = peripheral.device.address;
	peripheral.brewometerData.RSSI = peripheral.device.rssi;

	success(peripheral.brewometerData);


	// document.getElementById('temperature').innerHTML = ((temperature * 9.0 / 5.0) + 32.0).toFixed(2);
	// document.getElementById('specificGravity').innerHTML = (-0.0025 * pitchAverage + 1.1357).toFixed(3);
	// document.getElementById('pitch').innerHTML = pitch.toFixed(2);
	// document.getElementById('batteryLevel').innerHTML = ((batteryLevel / 100.0) * (3.53 - 1.95) + 1.95).toFixed(2);
}


// Display a status message
app.ui.displayStatus = function(message) {
	$('#scan-status').html(message);
};