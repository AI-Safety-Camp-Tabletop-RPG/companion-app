import refs from '../firebase'
import { update, push, onChildAdded, onChildChanged, onChildRemoved } from "firebase/database"

const computeActionStore = {
  state: () => ({
    computeActions: {},
    dirtyComputeActionID: null,
  }),
  getters: {
    dirtyComputeAction(state) {
      return state.computeActions[state.dirtyComputeActionID]
    },
  },
  mutations: {
    updateComputeAction(state, {actionID, payload}) {
      const currentComputeAction = state.computeActions[actionID] // this may be undefined, in which case we'd be creating a new action
      state.computeActions[actionID] = {...currentComputeAction, ...payload}
    },
    editNewComputeAction(state, {actionID, actionObj}) {
      // create new compute action
      this.commit('updateComputeAction', {actionID, payload: actionObj})
      state.dirtyComputeActionID = actionID
    },
    editExtantComputeAction(state, actionID) {
      state.dirtyComputeActionID = actionID
      state.computeActions[state.dirtyComputeActionID].isDirty = true
    },
    // this edit submission relies in the dirty compute action.
    submitComputeActionEdit(state) {
      if (state.dirtyComputeActionID === null) return //safeguard
      state.computeActions[state.dirtyComputeActionID].isDirty = false
      state.computeActions[state.dirtyComputeActionID].isNew = false
      state.dirtyComputeActionID = null
    },
    deleteComputeAction(state, computeActionID) {
      if (!state.computeActions[computeActionID]) throw new Error(`Cannot delete compute action ${computeActionID}: compute action does not exist`)
      delete state.computeActions[computeActionID]
    },
  },
  actions: {
    async listenToFBComputeActions({commit, state}) {
      onChildAdded(refs.computeActions, (snapshot) => {
        commit('updateComputeAction', {actionID: snapshot.key, payload: snapshot.val()})
      });
      onChildChanged(refs.computeActions, (snapshot) => {
        commit('updateComputeAction', {actionID: snapshot.key, payload: snapshot.val()})
      });
      onChildRemoved(refs.computeActions, (snapshot) => {
        if (!state.computeActions[snapshot.key]) return // safeguard against unnecessary deletion
        commit('deleteComputeAction', snapshot.key)
      });
    },
    async editNewComputeAction({commit}) {
      const actionObj = {
        name:'',
        desc:'',
        computeNeeded: 0,
        computeApplied: 0,
        computeToAdd: 0,
        isDirty: true,
        isNew: true,
      }
      const actionID = await push(refs.computeActions, actionObj).key
      commit('editNewComputeAction', {actionID, actionObj})
    },
    async editExtantComputeAction({commit, state}, actionID) {
      commit('editExtantComputeAction', actionID)
      await update(refs.computeActions, {[actionID]: state.computeActions[actionID]})
    },
    async submitComputeAction({commit, state}) {
      const actionID = state.dirtyComputeActionID
      commit('submitComputeActionEdit')
      await update(refs.computeActions, {[actionID]: state.computeActions[actionID]})
    },
    async deleteComputeAction({commit}, actionID) {
      commit('deleteComputeAction', actionID)
      await update(refs.computeActions, {[actionID]: null})
    },
    async modifyComputeToApply({commit, state, rootState}, {actionID, delta}) {
      const ca = state.computeActions[actionID]
      // if the compute action is maxed out, then back out
      if (ca.computeNeeded < ca.computeApplied + ca.computeToAdd + delta) return
      if (ca.computeToAdd + delta < 0) return
      commit('updateComputeAction', {
        actionID,
        payload: {
          computeToAdd: ca.computeToAdd + delta,
        }
      })
      commit('updateComputeToSpend', delta)
      await update(refs.computeActions, {[actionID]: state.computeActions[actionID]})
      await update(refs.computeTracker, {computeToSpend: rootState.compute.computeToSpend})
    },
    // calculate compute point assignment
    // NOTE this is a bit of a hack. we need to figure out a better way to do this
    // basically, it's very easy to create bugs
    // when any firebase sync happens before all calculations are resolved. 
    // Therefore we only commit during the loops,
    // and sync at the very end.
    async assignComputePoints({state, rootState, getters, commit, dispatch}) {
      rootState.compute.computeToSpend = 0 // to get new computeAvailable
      Object.values(state.computeActions).forEach(ca => {
        const computeAvailable = getters.computeAvailable
        // if there isn't enough compute available, then add however much is left
        let change = 0
        if (ca.computeToAdd > computeAvailable) {
          change = computeAvailable
        } else {
          change = ca.computeToAdd
        }
        commit('updateComputeSpent', change)
        ca.computeApplied += change
        const computeToHours = rootState.clock.cycleLength * (change / (getters.computeTotal - getters.recurringSum))
        commit('advanceTime', computeToHours)

        // calculate the computes to add for next assign, and new total compute to spend
        const remainingComputeNeeded = ca.computeNeeded - ca.computeApplied
        // if the bar is almost filled, then set compute to add to the remaining amount
        if (remainingComputeNeeded < ca.computeToAdd){
          ca.computeToAdd = remainingComputeNeeded
        }
        commit('updateComputeToSpend', ca.computeToAdd)
      })
      await dispatch('syncClock')
      await update(refs.computeActions, state.computeActions)
      await update(refs.computeTracker, {
        computeToSpend: rootState.compute.computeToSpend,
        computeSpent: rootState.compute.computeSpent,
      })
    },

  },
}

export default computeActionStore