class MainSearch extends HTMLElement {
	constructor() {
    super();
    this.allSearchInputs = document.querySelectorAll('input[type="search"]');
		this.input = this.querySelector('input[type="search"]');
    this.setupEventListeners();
  }

	setupEventListeners() {
		let allSearchForms = [];
		this.allSearchInputs.forEach(input => allSearchForms.push(input.form))
		this.input.addEventListener('focus', this.onInputFocus.bind(this));
		if (allSearchForms.length < 2) return;

		this.allSearchInputs.forEach(input =>
      input.addEventListener('input', this.onInput.bind(this))
    );
	}

	onInput(event) {
    const target = event.target;
    this.keepInSync(target.value, target);
  }

  onInputFocus() {
    const isSmallScreen = window.innerWidth < 750;
    if (isSmallScreen) {
      this.scrollIntoView({behavior: 'smooth'});
    }
  }

  keepInSync(value, target) {
    this.allSearchInputs.forEach(input => {
      if (input !== target) {
        input.value = value;
      }
    });
  }
}

customElements.define('main-search', MainSearch);