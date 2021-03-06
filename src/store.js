import { createStore } from 'vuex'

// import store modules
import eventLogStore from './stores/eventLogStore';
import computeStore from './stores/computeStore'
import computeActionStore from './stores/computeActionStore'
import clockStore from './stores/clockStore';

// HACK: use location hash to differentiate between different sessions.
// HACK: duplicated code getting the sessionID between here and firebase.js
const sessionID = window.location.hash.substring(1)

const store = createStore({
  modules: {
    eventLog: eventLogStore,
    compute: computeStore,
    computeAction: computeActionStore,
    clock: clockStore,
  },
  state () {
    return {
      sessionID: sessionID,
    }
  },
})

store.dispatch('listenToFBEventLog')
store.dispatch('listenToFBClock')
store.dispatch('listenToFBComputeTracker')
store.dispatch('listenToFBComputeActions')
// TODO: remember to dispatch actions for each module to listen to FB changes

export default store