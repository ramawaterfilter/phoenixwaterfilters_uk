document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-ot-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.ot-carousel__track');
    const prev = carousel.querySelector('[data-ot-prev]');
    const next = carousel.querySelector('[data-ot-next]');
    const slides = Array.from(carousel.querySelectorAll('.ot-contaminant-card'));
    if (!track || !slides.length) return;

    let index = 0;

    const getVisibleCount = () => {
      if (window.matchMedia('(max-width: 749px)').matches) return 1;
      if (window.matchMedia('(max-width: 989px)').matches) return 2;
      return 3;
    };

    const update = () => {
      const visible = getVisibleCount();
      const maxIndex = Math.max(0, slides.length - visible);
      index = Math.min(Math.max(index, 0), maxIndex);
      const slideWidth = slides[0].getBoundingClientRect().width;
      const gap = parseFloat(window.getComputedStyle(track).gap || 0);
      track.style.transform = `translateX(-${index * (slideWidth + gap)}px)`;
    };

    if (next) {
      next.addEventListener('click', () => {
        const maxIndex = Math.max(0, slides.length - getVisibleCount());
        index = index >= maxIndex ? 0 : index + 1;
        update();
      });
    }

    if (prev) {
      prev.addEventListener('click', () => {
        const maxIndex = Math.max(0, slides.length - getVisibleCount());
        index = index <= 0 ? maxIndex : index - 1;
        update();
      });
    }

    window.addEventListener('resize', update);
    update();
  });
});