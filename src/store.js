import { createStore } from 'vuex'

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// Follow this pattern to import other Firebase services
// import { } from 'firebase/<service>';
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, push, set, onChildAdded, onChildChanged, onChildRemoved } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCpQgKh8tRvW7IsWqy37jVCOAdFEGaP03w",
  authDomain: "aittrpg.firebaseapp.com",
  databaseURL: "https://aittrpg-default-rtdb.firebaseio.com/",
  projectId: "aittrpg",
  storageBucket: "aittrpg.appspot.com",
  messagingSenderId: "1094303719793",
  appId: "1:1094303719793:web:c89eb399670cb624d816d0",
};

// Initialize Firebase
const fbApp = initializeApp(firebaseConfig);
const analytics = getAnalytics(fbApp);
const db = getDatabase(fbApp);
const actionListRef = ref(db, 'actions')

const store = createStore({
  state () {
    return {
      actions: {},
      isEditorOpen: false,
      dirtyActionID: null,
    }
  },
  getters: {
    dirtyAction(state) {
      return state.actions[state.dirtyActionID]
    },
  },
  mutations: {
    setActionWithID(state, {actionID, actionObj}) {
      state.actions[actionID] = actionObj
    },
    editNewAction(state, {actionID, actionObj}) {
      // create new action
      store.commit('setActionWithID', {actionID, actionObj})
      state.dirtyActionID = actionID
      // open the editor
      state.isEditorOpen = true
    },
    editExtantAction(state, actionID) {
      state.dirtyActionID = actionID
      state.actions[state.dirtyActionID].isDirty = true
      state.isEditorOpen = true
    },
    updateAction (state, payload) {
      if (state.dirtyActionID === null) return // safeguard against creating null action
      const currentAction = state.actions[state.dirtyActionID]
      state.actions[state.dirtyActionID] = {...currentAction, ...payload}
    },
    submitActionEdit (state) {
      state.actions[state.dirtyActionID].isDirty = false
      state.actions[state.dirtyActionID].isNew = false
      state.dirtyActionID = null
    },
    commitAction (state, actionID) {
      state.actions[actionID].isCommitted = true
    },
    markAsForecast (state, actionID) {
      state.actions[actionID].isForecast = true
    },
    deleteAction(state, actionID) {
      if (!state.actions[actionID]) throw new Error(`Cannot delete action ${actionID}: action does not exist`)
      delete state.actions[actionID]
    },
    openEditor(state) {
      state.isEditorOpen = true
    },
    closeEditor(state) {
      state.isEditorOpen = false
    },
  },
  
  // vuex actions
  actions: {

    async editNewAction({commit}) {
      // create new action
      const actionObj = {
        name:'',
        description:'',
        isDirty: true,
        isNew: true,
        isCommitted: false,
        isForecast: false,
      }
      // push a new action into the database
      const actionID = await push(actionListRef, actionObj).key
      commit('editNewAction', {actionID, actionObj})
    },

    async editExtantAction({commit, state}, actionID) {
      commit('editExtantAction', actionID)
      await set(ref(db, `actions/${actionID}`), state.actions[actionID])
    },

    async submitActionEdit({commit, state}) {
      const actionID = state.dirtyActionID
      commit('submitActionEdit')
      await set(ref(db, `actions/${actionID}`), state.actions[actionID])
    },

    async deleteAction({commit}, actionID) {
      commit('deleteAction', actionID)
      await set(ref(db, `actions/${actionID}`), null)
    },

    async commitAction({commit, state}, actionID) {
      commit('commitAction', actionID)
      await set(ref(db, `actions/${actionID}`), state.actions[actionID])
    },

    async markAsForecast({commit, state}, actionID) {
      commit('markAsForecast', actionID)
      await set(ref(db, `actions/${actionID}`), state.actions[actionID])
    },

    // // bind to firebase
    // async initFirebase({commit}) {
    //   // get actions from firebase
    //   const actions = await db.ref('actions').once('value')
    //   commit('setActions', actions.val())
    // },
    // // firebase actions
    // async saveAction({commit, state}, actionID) {
    //   const action = state.actions[actionID]
    //   const actionRef = db.ref('actions/' + actionID)
    //   await actionRef.set(action)
    //   commit('commitAction', actionID)
    // },

    // bind to changes in firebase
    async initFirebaseListeners({commit}) {
      const actionsRef = ref(db, 'actions')
      
      onChildAdded(actionsRef, (data) => {
        commit('setActionWithID', {actionID: data.key, actionObj: data.val()})
      });
      onChildChanged(actionsRef, (data) => {
        commit('setActionWithID', {actionID: data.key, actionObj: data.val()})
      });
      onChildRemoved(actionsRef, (data) => {
        commit('deleteAction', data.key)
      });
      // NOTE do we need to handle 'child_moved'?
    }
  },
})

store.dispatch('initFirebaseListeners')

export default store