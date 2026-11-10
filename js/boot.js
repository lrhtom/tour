(() => {
  function showMessage(title, message) {
    const panel = document.createElement('main');
    panel.style.cssText = 'position:fixed;inset:0;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:24px;text-align:center;z-index:1000';
    const heading = document.createElement('h1');
    heading.style.cssText = 'font-size:20px;font-weight:500;margin:0';
    heading.textContent = title;
    const text = document.createElement('p');
    text.style.cssText = 'font-size:14px;color:#5f6368;margin:0;line-height:1.7';
    text.textContent = message;
    panel.append(heading, text);
    document.body.replaceChildren(panel);
  }
  if (location.protocol === 'file:') {
    showMessage('请通过网页地址打开', '部署到 GitHub Pages，或使用 Live Server 预览。');
    return;
  }
  const scriptUrl = document.currentScript.src;
  const appUrl = new URL('./app.js', scriptUrl);
  appUrl.search = new URL(scriptUrl).search;
  import(appUrl.href).catch(error => {
    console.error('App startup failed:', error);
    showMessage('页面暂时无法加载', '请刷新重试，或重新启动本地预览。');
  });
})();
