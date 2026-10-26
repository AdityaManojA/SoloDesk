// Old address → new address, keeping the path, query and #route (portal links use #/portal/...).
// A separate file because the site's CSP blocks inline scripts.
(function () {
  var to = 'https://terracove.web.app' + location.pathname + location.search + location.hash;
  location.replace(to);
  document.addEventListener('DOMContentLoaded', function () { var a = document.getElementById('to'); if (a) a.href = to; });
})();
