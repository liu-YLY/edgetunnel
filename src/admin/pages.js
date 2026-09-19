import { 转义HTML } from '../core/html.js';
async function nginx() {
	return `
	<!DOCTYPE html>
	<html>
	<head>
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and
	working. Further configuration is required.</p>

	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>

	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`
}

async function html1101(host, 访问IP) {
	const now = new Date();
	const 格式化时间戳 = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
	const 随机字符串 = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');

	return `<!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<!--[if IE 7]>    <html class="no-js ie7 oldie" lang="en-US"> <![endif]-->
<!--[if IE 8]>    <html class="no-js ie8 oldie" lang="en-US"> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en-US"> <!--<![endif]-->
<head>
<title>Worker threw exception | ${host} | Cloudflare</title>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=Edge" />
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" id="cf_styles-css" href="/cdn-cgi/styles/cf.errors.css" />
<!--[if lt IE 9]><link rel="stylesheet" id='cf_styles-ie-css' href="/cdn-cgi/styles/cf.errors.ie.css" /><![endif]-->
<style>body{margin:0;padding:0}</style>


<!--[if gte IE 10]><!-->
<script>
  if (!navigator.cookieEnabled) {
    window.addEventListener('DOMContentLoaded', function () {
      var cookieEl = document.getElementById('cookie-alert');
      cookieEl.style.display = 'block';
    })
  }
</script>
<!--<![endif]-->

</head>
<body>
    <div id="cf-wrapper">
        <div class="cf-alert cf-alert-error cf-cookie-error" id="cookie-alert" data-translate="enable_cookies">Please enable cookies.</div>
        <div id="cf-error-details" class="cf-error-details-wrapper">
            <div class="cf-wrapper cf-header cf-error-overview">
                <h1>
                    <span class="cf-error-type" data-translate="error">Error</span>
                    <span class="cf-error-code">1101</span>
                    <small class="heading-ray-id">Ray ID: ${随机字符串} &bull; ${格式化时间戳} UTC</small>
                </h1>
                <h2 class="cf-subheadline" data-translate="error_desc">Worker threw exception</h2>
            </div><!-- /.header -->

            <section></section><!-- spacer -->

            <div class="cf-section cf-wrapper">
                <div class="cf-columns two">
                    <div class="cf-column">
                        <h2 data-translate="what_happened">What happened?</h2>
                            <p>You've requested a page on a website (${host}) that is on the <a href="https://www.cloudflare.com/5xx-error-landing?utm_source=error_100x" target="_blank">Cloudflare</a> network. An unknown error occurred while rendering the page.</p>
                    </div>

                    <div class="cf-column">
                        <h2 data-translate="what_can_i_do">What can I do?</h2>
                            <p><strong>If you are the owner of this website:</strong><br />refer to <a href="https://developers.cloudflare.com/workers/observability/errors/" target="_blank">Workers - Errors and Exceptions</a> and check Workers Logs for ${host}.</p>
                    </div>

                </div>
            </div><!-- /.section -->

            <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
    <p class="text-13">
      <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold"> ${随机字符串}</strong></span>
      <span class="cf-footer-separator sm:hidden">&bull;</span>
      <span id="cf-footer-item-ip" class="cf-footer-item hidden sm:block sm:mb-1">
        Your IP:
        <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
        <span class="hidden" id="cf-footer-ip">${访问IP}</span>
        <span class="cf-footer-separator sm:hidden">&bull;</span>
      </span>
      <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing" id="brand_link" target="_blank">Cloudflare</a></span>

    </p>
    <script>(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
  </div><!-- /.error-footer -->

        </div><!-- /#cf-error-details -->
    </div><!-- /#cf-wrapper -->

     <script>
    window._cf_translation = {};


  </script>
</body>
</html>`;
}

// 登录页是面板的入口，故沿用同一套色彩/形状语言（切角卡片 + 青蓝强调色），
// 但不引入任何外部资源。CSP 由 default-src 'none' 放宽到 style-src 'unsafe-inline'：
// 脚本仍全禁、message 已转义（无样式注入入口），且样式里即使出现 url() 也会被
// default-src 'none' 拦住，无法用于外发数据。
const 登录样式 = `:root{color-scheme:dark;--bg:#060a12;--surf:rgba(18,28,46,.78);--line:rgba(120,170,255,.22);--fg:#dce7f5;--mut:#7d90ad;--acc:#4da3ff;--acc2:#35e0d8;--err:#ff8a80;--btnfg:#06121f}
@media(prefers-color-scheme:light){:root{color-scheme:light;--bg:#f6f9fd;--surf:rgba(255,255,255,.86);--line:rgba(30,60,110,.2);--fg:#16233a;--mut:#5b6b85;--acc:#2f6fe4;--acc2:#0b7f77;--err:#c0392b;--btnfg:#fff}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--fg);font:400 14px/1.5 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
main{width:100%;max-width:340px;background:var(--surf);border:1px solid var(--line);padding:22px;clip-path:polygon(0 10px,10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
h1{margin:0 0 8px;font-size:17px;letter-spacing:.6px}
p{margin:0 0 12px;font-size:13px;color:var(--mut)}
p:last-child{margin:14px 0 0}
#msg{min-height:18px;margin:0 0 10px;color:var(--err)}
label{display:block;font-size:12px;color:var(--mut)}
input{width:100%;margin-top:6px;padding:11px 10px;font-size:14px;color:var(--fg);background:transparent;border:1px solid var(--line);outline:none}
input:focus{border-color:var(--acc2);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc2) 26%,transparent)}
button{width:100%;min-height:44px;margin-top:16px;border:0;color:var(--btnfg);background:linear-gradient(135deg,var(--acc2),var(--acc));font-size:14px;font-weight:600;cursor:pointer;clip-path:polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--acc2);outline-offset:-2px}
a{color:var(--acc)}`;

function 登录页面(message = '', status = 200) {
 return new Response(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>EdgeTunnel 登录</title><style>${登录样式}</style></head><body><main><h1>EdgeTunnel</h1><p>请输入管理员密码以进入管理面板。</p><p id="msg" role="status">${转义HTML(message)}</p><form method="post"><label for="password">管理员密码</label><input id="password" name="password" type="password" required autocomplete="current-password"><button>登录</button></form><p>登录成功后<a href="/admin">进入管理后台</a>。</p></main></body></html>`, { status, headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
}

export { html1101, nginx, 登录页面 };
