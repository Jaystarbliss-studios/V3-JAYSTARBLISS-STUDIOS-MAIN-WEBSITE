window.addEventListener('error', function(e) {
  document.body.innerHTML += '<div style="color:red;z-index:9999;position:fixed;top:0;left:0;background:white;padding:20px;font-size:20px">' + e.error.message + '<br>' + e.error.stack + '</div>';
});
