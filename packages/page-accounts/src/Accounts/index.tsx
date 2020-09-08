// Copyright 2017-2020 @polkadot/app-accounts authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { ActionStatus } from '@polkadot/react-components/Status/types';
import { AccountId, ProxyDefinition, ProxyType, Voting } from '@polkadot/types/interfaces';
import { Delegation, SortedAccount } from '../types';

import BN from 'bn.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import keyring from '@polkadot/ui-keyring';
import { getLedger, isLedger } from '@polkadot/react-api';
import { useApi, useAccounts, useCall, useFavorites, useIpfs, useLoadingDelay, useToggle } from '@polkadot/react-hooks';
import { FormatBalance } from '@polkadot/react-query';
import { Button, Icon, InputNew, Table } from '@polkadot/react-components';
import { BN_ZERO } from '@polkadot/util';

import { useTranslation } from '../translate';
import CreateModal from '../modals/Create';
import NewCreateModal from './modals/NewCreate';
import ImportModal from '../modals/Import';
import Multisig from '../modals/MultisigCreate';
import Proxy from '../modals/ProxiedAdd';
import Qr from '../modals/Qr';
import Account from './Account';
import BannerClaims from './BannerClaims';
import BannerExtension from './BannerExtension';
import { sortAccounts } from '../util';

interface Balances {
  accounts: Record<string, BN>;
  balanceTotal?: BN;
}

interface Sorted {
  sortedAccounts: SortedAccount[];
  sortedAddresses: string[];
}

interface Props {
  className?: string;
  onStatusChange: (status: ActionStatus) => void;
}

const STORE_FAVS = 'accounts:favorites';

// query the ledger for the address, adding it to the keyring
async function queryLedger (): Promise<void> {
  const ledger = getLedger();

  try {
    const { address } = await ledger.getAddress();

    keyring.addHardware(address, 'ledger', { name: 'ledger' });
  } catch (error) {
    console.error(error);
  }
}

function Overview ({ className = '', onStatusChange }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const { allAccounts } = useAccounts();
  const { isIpfs } = useIpfs();
  const [isCreateOpen, toggleCreate] = useToggle();
  const [isCreateOpen2, toggleCreate2] = useToggle();
  const [isImportOpen, toggleImport] = useToggle();
  const [isMultisigOpen, toggleMultisig] = useToggle();
  const [isProxyOpen, toggleProxy] = useToggle();
  const [isQrOpen, toggleQr] = useToggle();
  const [favorites, toggleFavorite] = useFavorites(STORE_FAVS);
  const [{ balanceTotal }, setBalances] = useState<Balances>({ accounts: {} });
  const [filterOn, setFilter] = useState<string>('');
  const [sortedAccountsWithDelegation, setSortedAccountsWithDelegation] = useState<SortedAccount[] | undefined>();
  const [{ sortedAccounts, sortedAddresses }, setSorted] = useState<Sorted>({ sortedAccounts: [], sortedAddresses: [] });
  const delegations = useCall<Voting[]>(api.query.democracy?.votingOf?.multi, [sortedAddresses]);
  const proxies = useCall<[ProxyDefinition[], BN][]>(api.query.proxy?.proxies.multi, [sortedAddresses], {
    transform: (result: [([AccountId, ProxyType] | ProxyDefinition)[], BN][]): [ProxyDefinition[], BN][] =>
      api.tx.proxy.addProxy.meta.args.length === 4
        ? result as [ProxyDefinition[], BN][]
        : (result as [[AccountId, ProxyType][], BN][]).map(([arr, bn]): [ProxyDefinition[], BN] =>
          [arr.map(([delegate, proxyType]): ProxyDefinition => api.createType('ProxyDefinition', { delegate, proxyType })), bn]
        )
  });
  const isLoading = useLoadingDelay();

  const headerRef = useRef([
    [t('accounts'), 'start', 3],
    [t('parent'), 'address ui--media-1400'],
    [t('type')],
    [t('tags'), 'start'],
    [t('transactions'), 'ui--media-1500'],
    [t('balances')],
    [],
    [undefined, 'mini ui--media-1400']
  ]);

  useEffect((): void => {
    const sortedAccounts = sortAccounts(allAccounts, favorites);
    const sortedAddresses = sortedAccounts.map((a) => a.account.address);

    setSorted({ sortedAccounts, sortedAddresses });
  }, [allAccounts, favorites]);

  useEffect(() => {
    if (api.query.democracy?.votingOf && !delegations?.length) {
      return;
    }

    setSortedAccountsWithDelegation(
      sortedAccounts?.map((account, index) => {
        let delegation: Delegation | undefined;

        if (delegations && delegations[index]?.isDelegating) {
          const { balance: amount, conviction, target } = delegations[index].asDelegating;

          delegation = {
            accountDelegated: target.toString(),
            amount,
            conviction
          };
        }

        return ({
          ...account,
          delegation
        });
      })
    );
  }, [api, delegations, sortedAccounts]);

  const _setBalance = useCallback(
    (account: string, balance: BN) =>
      setBalances(({ accounts }: Balances): Balances => {
        accounts[account] = balance;

        return {
          accounts,
          balanceTotal: Object.values(accounts).reduce((total: BN, value: BN) => total.add(value), BN_ZERO)
        };
      }),
    []
  );

  const footer = useMemo(() => (
    <tr>
      <td colSpan={3} />
      <td className='ui--media-1400' />
      <td colSpan={2} />
      <td className='ui--media-1500' />
      <td className='number'>
        {balanceTotal && <FormatBalance value={balanceTotal} />}
      </td>
      <td />
      <td className='ui--media-1400' />
    </tr>
  ), [balanceTotal]);

  const filter = useMemo(() => (
    <div className='filter--tags'>
      <div className="filter-input-wrapper">
        <InputNew
          autoFocus
          isFull
          label={t<string>('filter by name or tags')}
          placeholder="Search"
          onChange={setFilter}
          value={filterOn}
        />
        <Icon icon='search'/>
      </div>
    </div>
  ), [filterOn, t]);

  return (
    <div className={className}>
      <BannerExtension />
      <BannerClaims />
      {isCreateOpen && (
        <CreateModal
          onClose={toggleCreate}
          onStatusChange={onStatusChange}
        />
      )}
      {isCreateOpen2 && (
        <NewCreateModal
          onClose={toggleCreate2}
          onStatusChange={onStatusChange}
        />
      )}
      {isImportOpen && (
        <ImportModal
          onClose={toggleImport}
          onStatusChange={onStatusChange}
        />
      )}
      {isMultisigOpen && (
        <Multisig
          onClose={toggleMultisig}
          onStatusChange={onStatusChange}
        />
      )}
      {isProxyOpen && (
        <Proxy
          onClose={toggleProxy}
          onStatusChange={onStatusChange}
        />
      )}
      {isQrOpen && (
        <Qr
          onClose={toggleQr}
          onStatusChange={onStatusChange}
        />
      )}
      <div className="accounts-top-row">
        {filter}
        <Button.Group>
          <Button
            icon='plus'
            isDisabled={isIpfs}
            label={t<string>('Add account')}
            onClick={toggleCreate}
          />
          <Button
            icon='plus'
            isDisabled={isIpfs}
            label={t<string>('Add account 2')}
            onClick={toggleCreate2}
            data-testid='addAccount2'
          />
          <Button
            icon='sync'
            isDisabled={isIpfs}
            label={t<string>('Restore JSON')}
            onClick={toggleImport}
          />
          <Button
            icon='qrcode'
            label={t<string>('Add via Qr')}
            onClick={toggleQr}
          />
          {isLedger() && (
            <>
              <Button
                icon='question'
                label={t<string>('Query Ledger')}
                onClick={queryLedger}
              />
            </>
          )}
          <Button
            icon='plus'
            isDisabled={!(api.tx.multisig || api.tx.utility)}
            label={t<string>('Multisig')}
            onClick={toggleMultisig}
          />
          <Button
            icon='plus'
            isDisabled={!api.tx.proxy}
            label={t<string>('Proxied')}
            onClick={toggleProxy}
          />
        </Button.Group>
      </div>
      <Table
        empty={!isLoading && sortedAccountsWithDelegation && t<string>("You don't have any accounts. Some features are currently hidden and will only become available once you have accounts.")}
        footer={footer}
        header={headerRef.current}
      >
        {isLoading ? undefined : sortedAccountsWithDelegation?.map(({ account, delegation, isFavorite }, index): React.ReactNode => (
          <Account
            account={account}
            delegation={delegation}
            filter={filterOn}
            isFavorite={isFavorite}
            key={account.address}
            proxy={proxies?.[index]}
            setBalance={_setBalance}
            toggleFavorite={toggleFavorite}
          />
        ))}
      </Table>
    </div>
  );
}

export default React.memo(styled(Overview)`
  .accounts-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2.28rem
  }
  .ui--Button-Group {

    .ui--Button {
      height: 2.85rem;
      padding: 0.65rem 1.7rem 0.65rem 1.8rem;
    }
  }

  .filter--tags {
    display: inline-block;
    max-width: 365px;
    width: 100%;
    
    .ui--Dropdown {
      padding-left: 0;

      label {
        left: 1.55rem;
      }
    }

    .filter-input-wrapper {
      position: relative;
      color: #8B8B8B;

      svg {
        position: absolute;
        bottom: 1.07rem;
        left: 1.2rem;
      }
    }
    
    .ui.input>input {
      height: 2.85rem;
      padding: 0.65rem 0.65rem 0.65rem 3.15rem;
    }
  
  }
`);
