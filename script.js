'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; //in km
    this.duration = duration; //in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPase();
    this._setDescription();
  }

  calcPase() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Aplication architecture

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const editWorkoutBtn = document.querySelector('.workout__edit-btn');
const workoutsContainer = document.querySelector('.sidebar');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #isEditing;
  #editingWorkout;
  #editingWorkoutDOM;

  constructor() {
    this._getPosition();

    // Get data from local storage
    this._getLocaleStorage();

    form.addEventListener('submit', this._handleSubmit.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));

    workoutsContainer.addEventListener('click', this._cancelEditing.bind(this));

    this.#isEditing = false;
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    // console.log(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    // Now map exists, so render markers
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allpositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allpositive(distance, duration, cadence)
      )
        return alert('All inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cyclig, create running object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allpositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new workout to workout array
    this.#workouts.push(workout);

    // Render workout on the map
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    //Hide form and clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    workout.marker = marker;
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <button class="workout__edit-btn">Edit</button>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;
    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
    `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target?.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // Using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    // Copy of workouts without the marker property
    const workoutsCleaned = this.#workouts.map(workout => {
      const clone = { ...workout };
      delete clone.marker; // Remove circular reference
      return clone;
    });

    localStorage.setItem('workouts', JSON.stringify(workoutsCleaned));
  }

  _getLocaleStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map(obj => {
      if (obj.type === 'running') {
        const run = Object.assign(new Running([], 0, 0, 0), obj);
        run.date = new Date(obj.date);
        return run;
      }
      if (obj.type === 'cycling') {
        const cyc = Object.assign(new Cycling([], 0, 0, 0), obj);
        cyc.date = new Date(obj.date);
        return cyc;
      }
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  // My code

  _editWorkout(e) {
    const editBtn = e.target?.closest('.workout__edit-btn');
    if (!editBtn) return;

    const newEditingDOM = editBtn.closest('.workout');

    if (this.#editingWorkoutDOM && this.#editingWorkoutDOM !== newEditingDOM) {
      this.#editingWorkoutDOM.style.display = '';
    }

    this.#editingWorkoutDOM = newEditingDOM;
    const workoutId = this.#editingWorkoutDOM.dataset.id;

    this.#editingWorkout = this.#workouts.find(
      workout => workout.id === workoutId
    );

    if (editBtn) {
      // "Turn on edit mode"
      this.#isEditing = true;

      // Hide workout container
      this.#editingWorkoutDOM.style.display = 'none';

      // Show current workout data in the form
      const currWorkoutObj = this.#workouts.find(
        workout => workout.id === workoutId
      );

      inputType.value = currWorkoutObj.type;
      inputDistance.value = currWorkoutObj.distance;
      inputDuration.value = currWorkoutObj.duration;

      if (currWorkoutObj.type === 'running') {
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputCadence.value = currWorkoutObj.cadence;
      } else if (currWorkoutObj.type === 'cycling') {
        inputElevation
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation.value = currWorkoutObj.elevationGain;
      }

      // Show form
      this._showForm();

      // Submit - replace current data with new data in workout array
      // Event listener is in the constructor

      // Update popup description color

      // Fix coords bug

      // Test local storage
    }
  }

  _replaceWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allpositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const workout = this.#editingWorkout;

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#editingWorkout.coords;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allpositive(distance, duration, cadence)
      )
        return alert('All inputs have to be positive numbers!');

      workout.type = type;
      workout.distance = distance;
      workout.duration = duration;
      workout.cadence = cadence;
      workout.pace = workout.duration / workout.distance;
    }

    // If workout cyclig, create running object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allpositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout.type = type;
      workout.distance = distance;
      workout.duration = duration;
      workout.elevation = elevation;
      workout.speed = workout.distance / (workout.duration / 60);
    }

    workout.id = this.#editingWorkout.id;
    workout.date = this.#editingWorkout.date;

    //Remove old workout element from the DOM
    this.#editingWorkoutDOM.remove();

    // Set updated description
    workout._setDescription();
    workout.marker.setPopupContent(
      `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
    );

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form and clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Turn off "editing mode" and reset custom fields after editing
    this.#isEditing = false;
    this.#editingWorkout = null;
    this.#editingWorkoutDOM = null;
  }

  _handleSubmit(e) {
    if (this.#isEditing) {
      this._replaceWorkout(e);
    } else {
      this._newWorkout(e);
    }
  }

  //Show workout container when cklicked sidebar padding
  _cancelEditing(e) {
    if (!this.#isEditing) return;

    const clickedElement = e.target;
    const clickedInsideForm = form.contains(clickedElement);
    const clickedAnyWorkout = !!clickedElement.closest('.workout');
    const clickedEditBtn = !!clickedElement.closest('.workout__edit-btn');

    // Do nothing if the click is on the form, any workout, or an edit button
    if (clickedInsideForm || clickedAnyWorkout || clickedEditBtn) return;

    // Otherwise, it's sidebar padding/background → cancel editing

    this._hideForm();
    if (this.#editingWorkoutDOM) this.#editingWorkoutDOM.style.display = '';
    this.#isEditing = false;
  }
}

const app = new App();
