(() => {
  const intro = document.querySelector(".funding-intro");
  if (!intro) return;

  const updateVisibility = () => {
    intro.hidden = window.scrollY > 0;
  };

  updateVisibility();
  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("pageshow", updateVisibility);
})();
