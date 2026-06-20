(() => {
  const roots = document.querySelectorAll('[data-help-center-converted]');

  roots.forEach((root) => {
    const searchForm = root.querySelector('.hc-search');

    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        const input = searchForm.querySelector('input[name="q"]');
        const value = input ? input.value.trim() : '';

        if (!value) {
          event.preventDefault();
          if (input) input.focus();
          return;
        }

        if (input) input.value = value;
      });
    }
  });
})();