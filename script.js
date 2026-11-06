// Smooth scroll enhancement for navigation links
document.addEventListener('DOMContentLoaded', function() {
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const header = document.querySelector('header');
        const headerHeight = header ? header.offsetHeight : 60;
        const top = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });
});
