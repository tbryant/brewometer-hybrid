jQuery.noConflict();

var OS_Adder={
    initialize: function() {
      // quit if this function has already been called
      if (arguments.callee.done) return;

      // flag this function so we don't do the same thing twice
      arguments.callee.done = true;

      // kill the timer
      if (_timer) clearInterval(_timer);

      // do stuff
      OS_Adder.main_function(jQuery);
    },

    main_function:function($){
      os = OS_Adder.getOS()
        // language is extra, it will become a backend-selection, if language is needed.
        // if you, my dear user, want the language also added as a class, simply de-comment the 2 lines below.
        //lang = OS_Adder.getLang();  
        // $("body").addClass(lang);
      $("body").addClass(os);
    
    },
    // returns the operating system or "os-unknown"
    getOS:function(){
      if (navigator.platform.toUpperCase().indexOf('MAC')!==-1) return ("mac");
      else if(navigator.userAgent.indexOf('WOW64')!=-1 || window.navigator.platform.toUpperCase().indexOf('WIN64')!==-1) return "win64";
      else if(navigator.platform.toUpperCase().indexOf('WIN')!==-1) return "win";
      else if(navigator.platform.toUpperCase().indexOf('IPAD')!==-1) return "iPad";
      else if(navigator.platform.toUpperCase().indexOf('IPOD')!==-1) return "iPod";
      else if(navigator.platform.toUpperCase().indexOf('IPHONE')!==-1) return "iPhone";
      else if(navigator.platform.toUpperCase().indexOf('LINUX ARMV7L')!==-1) return "android";
      else if(navigator.platform.toUpperCase().indexOf('LINUX')!==-1) return "linux";
      else if(navigator.platform.toUpperCase().indexOf('ARM')!==-1) return "smartphone";
      else return "os-unknown";
    },
    // returns the language-abbreviation or "lang-unknown"
    getLang:function(){
      lang = navigator.language || navigator.userLanguage || "language-unknown";
      pos = lang.indexOf("-");
      if(pos>=0){
        lang = lang.substring(0,pos);
      }
      return lang;
    }
}


/* for Mozilla/Opera9 */
if (document.addEventListener) {
  document.addEventListener("DOMContentLoaded", OS_Adder.initialize, false);
}
/* for Internet Explorer */
/*@cc_on @*/
/*@if (@_win32)
  document.write("<script id=__ie_onload defer src=javascript:void(0)><\/script>");
  var script = document.getElementById("__ie_onload");
  script.onreadystatechange = function() {
    if (this.readyState == "complete") {
      init(); // call the onload handler
    }
  };
/*@end @*/

/* for Safari */
if (/WebKit/i.test(navigator.userAgent)) { // sniff
  var _timer = setInterval(function() {
    if (/loaded|complete/.test(document.readyState)) {
      OS_Adder.initialize(); // call the onload handler
    }
  }, 10);
}

/* for other browsers */

window.onload = OS_Adder.initialize;