// Runs synchronously in <head> (rendered from a Server Component) so the
// correct class is on <html> before first paint. Keep in sync with theme.ts.
export const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
