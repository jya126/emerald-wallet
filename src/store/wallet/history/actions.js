// @flow
import createLogger from '../../../utils/logger';
import type { Transaction } from './types';
import ActionTypes from './actionTypes';
import { address as isAddress} from '../../../lib/validators';
import { storeTransactions, loadTransactions } from './historyStorage';
import { allTrackedTxs, selectByHash } from './selectors';

const log = createLogger('historyActions');
const txStoreKey = (chainId) => `chain-${chainId}-trackedTransactions`;
const currentChainId = (state) => state.wallet.history.get('chainId');

function persistTransactions(state) {
  storeTransactions(
    txStoreKey(currentChainId(state)),
    allTrackedTxs(state).toJS());
}

function loadPersistedTransactions(state): Array<Transaction> {
  return loadTransactions(txStoreKey(currentChainId(state)));
}

export function trackTx(tx) {
  return (dispatch, getState) => {
    persistTransactions(getState());
    return dispatch(trackTxAction(tx));
  };
}

export function trackTxAction(tx) {
  return {
    type: ActionTypes.TRACK_TX,
    tx,
  };
}

export function processPending(transactions: Array<any>) {
  return (dispatch, getState) => {
    dispatch({
      type: ActionTypes.PENDING_TX,
      txList: transactions,
    });
    persistTransactions(getState());
  };
}

export function init(chainId: number) {
  return (dispatch, getState) => {
    log.debug(`Switching to chainId = ${chainId}`);

    // set chain
    dispatch({
      type: ActionTypes.CHAIN_CHANGED,
      chainId,
    });

    // load history for chain
    const storedTxs = loadPersistedTransactions(getState());
    dispatch({
      type: ActionTypes.LOAD_STORED_TXS,
      transactions: storedTxs,
    });
  };
}

/**
 * Refresh only tx with totalRetries <= 10
 */
export function refreshTrackedTransactions() {
  return (dispatch, getState, api) => {
    const state = getState();
    const hashes = allTrackedTxs(getState())
      .filter((tx) => tx.get('totalRetries', 0) <= 10)
      .filter((tx) => state.wallet.settings.get('numConfirmations') < tx.get('blockNumber') - state.network.get('currentBlock').get('height'))
      .map((tx) => tx.get('hash'));

    return api.geth.ext.getTransactions(hashes).then((result) => {
      const transactions = result.map((tx) => tx.result);
      dispatch({
        type: ActionTypes.UPDATE_TXS,
        transactions,
      });
      /** TODO: Check for input data **/
      if ((result.creates !== undefined) && (isAddress(result.creates) === undefined)) {
        dispatch({
          type: 'CONTRACT/UPDATE_CONTRACT',
          tx: result,
          address: result.creates,
        });
      }

      return persistTransactions(getState());
    });
  };
}

/**
 * Split an array into chunks of a given size
 */
function chunk(array, chunkSize) {
  const groups = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    groups.push(array.slice(i, i + chunkSize));
  }
  return groups;
}
