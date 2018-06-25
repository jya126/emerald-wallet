import { fromJS } from 'immutable';
import { EthRpc, JsonRpc } from 'emerald-js';
import { processPending, refreshTrackedTransactions } from './actions';
import { loadTransactions } from './historyStorage';
import ActionTypes from './actionTypes';


describe('historyActions/refreshTrackedTransactions', () => {
  const getState = () => ({
    network: fromJS({
      currentBlock: {
        height: 100,
      },
    }),
    wallet: {
      settings: fromJS({
        numConfirmations: 10,
      }),
      history: fromJS({
        chainId: 'morden',
        trackedTransactions: [{numConfirmations: 0, hash: '0x123'}],
      }),
    },
  });

  it('should call eth.getTransaction rpc endpoint', () => {
    const mockGetTransactions = jest.fn(() => Promise.resolve([]));
    const ethRpc = { geth: { ext: { getTransactions: mockGetTransactions } } };
    const dispatch = jest.fn();

    const hash = '0x123';
    return refreshTrackedTransactions(hash)(dispatch, getState, ethRpc).then(() => {
      expect(mockGetTransactions).toHaveBeenCalled();
    });
  });
});

describe('historyActions/processPending', () => {
  it('should persist txs', () => {
    const getState = () => {
      return {
        wallet: {
          settings: fromJS({
            numConfirmations: 10,
          }),
          history: fromJS({
            trackedTransactions: [{hash: '0x123'}],
            chainId: 1,
          }),
        },
      };
    };

    const dispatch = jest.fn();

    const before = loadTransactions('chain-1-trackedTransactions');
    expect(before).toHaveLength(0);

    // do
    processPending([{}])(dispatch, getState);

    // assert
    const after = loadTransactions('chain-1-trackedTransactions');
    expect(after).toHaveLength(1);
  });
});
