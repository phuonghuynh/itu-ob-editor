import { ipcRenderer } from 'electron';
import React, { useState, useEffect } from 'react';

import { NonIdealState, Checkbox, Button, Callout, TextArea, Popover } from '@blueprintjs/core';
import { PaneHeader } from 'coulomb/renderer/widgets/pane-header';
import { WindowComponentProps } from 'coulomb/config/renderer';
//import { request, openWindow, notifyAllWindows } from 'sse/api/renderer';
import { WindowToaster } from 'renderer/toaster';
import { conf, app } from '..';

import * as styles from './styles.scss';
import { callIPC, relayIPCEvent } from 'coulomb/ipc/renderer';
import { useModifiedIDs } from 'renderer/hooks';


//type AnyIDType = string | number;
type AnyDataType = keyof typeof conf["app"]["data"];


interface ModifiedFileOverviewProps {
  itemIDs: string[],
  selectedItemIDs: string[],
  onSelect: (objId: string) => void,
}


/* Per content type definitions of modified file listing components. */

const modifiedFileListing: { [K in AnyDataType ]: React.FC<ModifiedFileOverviewProps> } =
[...Object.entries(conf.app.data)].map(([key, value]) => {
  return {
    [key]: (props: ModifiedFileOverviewProps) => <>
      <PaneHeader align="left">{props.itemIDs.length} modified {props.itemIDs.length !== 1 ? value.verboseNamePlural : value.verboseName}</PaneHeader>

      <div className={styles.itemList}>
        {props.itemIDs.map(itemID => <ItemCard
          title={itemID}
          onEdit={(conf.objectEditorWindows || {})[key] ? (() => app.openObjectEditor(key, itemID)) : undefined}
          onSelect={() => props.onSelect(itemID)}
          isSelected={props.selectedItemIDs.indexOf(itemID) >= 0} />)}
      </div>
    </>,
  };
}).reduce((prevValue, currValue) => ({ ...prevValue, ...currValue }));

// const modifiedFileListing: { [K in keyof Storage]: React.FC<ModifiedFileOverviewProps<Storage[K] & any>> } = {
//   // IMPORTANT: key is implied to be corresponding FS backend directory relative to Git working directory.
// 
//   issues: ({ items, selectedItems, onSelect }) => <>
//     <PaneHeader align="left">{items.length} modified OB {items.length !== 1 ? "editions" : "edition"}</PaneHeader>
// 
//     <div className={styles.itemList}>
//       {items.map(item => <ItemCard
//         title={item.id}
//         onEdit={() => app.openObjectEditor('issues', { objectID: item.id })}
//         onSelect={() => onSelect(item.id)}
//         isSelected={selectedItems.indexOf(item.id) >= 0} />)}
//     </div>
//   </>,
// 
//   publications: ({ items, selectedItems, onSelect }) => <>
//     <PaneHeader align="left">{items.length} modified service {items.length !== 1 ? "publications" : "publication"}</PaneHeader>
// 
//     <div className={styles.itemList}>
//       {items.map(item => <ItemCard
//         title={item.id}
//         onEdit={() => app.openObjectEditor('publications', { objectID: item.id })}
//         onSelect={() => onSelect(item.id)}
//         isSelected={selectedItems.indexOf(item.id) >= 0} />)}
//     </div>
//   </>,
// 
//   recommendations: (recs) => <>
//   </>,
// };


const contentTypes: AnyDataType[] = [
  'issues',
  'publications',
  'recommendations',
];


const Window: React.FC<WindowComponentProps> = function () {
  // read-uncommitted-ids
  //const modifiedIds = useModified();

  const modifiedIds = useModifiedIDs();

  // useIDs in a loop over app data?
  //const storage = useStorage();

  const allIds: { [K in AnyDataType]: string[] } =
  Object.keys(conf.app.data).map((key) => {
    return {
      [key]: app.useIDs(key).ids.map(id => `${id}`),
    };
  }).reduce((prevValue, currValue) => ({ ...prevValue, ...currValue }));


  // selectedItems = { objType1: [id1, id2], objType2: [id3, id4] }
  const initSelectedItems: { [K in AnyDataType]: string[] } = Object.assign(
    {}, ...contentTypes.map(c => ({ [c]: [] })));
  const [selectedItems, updateSelectedItems] = useState(initSelectedItems);


  // Make sure selected items don’t contain IDs that are no longer modified.
  // Could happen e.g. after user discards or commits changes.
  useEffect(() => {
    var selectedValid = { ...selectedItems };
    for (const [ctype, items] of Object.entries(selectedValid)) {
      selectedValid[ctype] = items.filter(i => modifiedIds[ctype].indexOf(i) >= 0);
    }
    updateSelectedItems(selectedValid);
  }, [JSON.stringify(modifiedIds)]);


  const [commitMessage, updateCommitMessage] = useState('');
  const [commitPromptIsOpen, toggleCommitPrompt] = useState(false);
  const [commitInProgress, updateCommitInProgress] = useState(false);

  const [discardingInProgress, updateDiscardingInProgress] = useState(false);
  const [discardConfirmationIsOpen, toggleDiscardConfirmation] = useState(false);

  const hasModifiedItems = Object.values(modifiedIds).
    reduce((acc, val) => { return [ ...acc, ...Object.keys(val) ] }, [] as string[]).length > 0;

  const hasSelectedItems = Object.values(selectedItems).
    reduce((acc, val) => [ ...acc, ...val ]).length > 0;

  const buttonsDisabled = !hasSelectedItems || commitPromptIsOpen || discardConfirmationIsOpen;


  /* Event handlers */

  function onSelect(ctype: AnyDataType, id: string) {
    var selected = selectedItems[ctype];
    const selectedIdx = selected.indexOf(id);
    if (selectedIdx >= 0) {
      selected.splice(selectedIdx, 1);
    } else {
      selected.push(id);
    }
    updateSelectedItems({ ...selectedItems, [ctype]: selected });
  }

  function handleCommitMessageChange(evt: React.FormEvent<HTMLElement>) {
    updateCommitMessage((evt.target as HTMLInputElement).value as string);
  }

  async function handleDiscard() {
    updateDiscardingInProgress(true);

    try {
      await Promise.all([...Object.entries(selectedItems).map(
        async ([ctype, objectIDs]: [AnyDataType, string[]]) =>
          await callIPC<{ objectIDs: string[] }, { success: true }>
          (`model-${ctype}-discard-all-uncommitted`, { objectIDs })
      )]);
      await ipcRenderer.send('remote-storage-trigger-uncommitted-check');
    } catch (e) {
      WindowToaster.show({ intent: 'danger', message: "Error occured while discarding changes to selected items" });
      updateDiscardingInProgress(false);
      return;
    }

    // Notify windows about changed objects
    await Promise.all([...Object.entries(selectedItems).map(
      async ([ctype, ids]: [AnyDataType, string[]]) =>
        await relayIPCEvent({ eventName: `model-${ctype}-objects-changed`, eventPayload: { ids }})
    )])

    updateDiscardingInProgress(false);
    toggleDiscardConfirmation(false);
  }

  async function handleCommit() {
    updateCommitInProgress(true);

    try {
      await Promise.all([...Object.entries(selectedItems).map(
        async ([ctype, objectIDs]: [AnyDataType, string[]]) =>
          await callIPC<{ objectIDs: string[], commitMessage: string }, { success: true }>
          (`model-${ctype}-commit-objects`, { objectIDs, commitMessage })
      )]);
      await ipcRenderer.send('remote-storage-trigger-sync');
    } catch (e) {
      WindowToaster.show({ intent: 'danger', message: "Error occured while committing selected items" });
      updateCommitInProgress(false);
      return;
    }

    updateCommitInProgress(false);
    updateCommitMessage('');
    toggleCommitPrompt(false);
  }

  return (
    <div className={styles.batchCommitWindow}>
      <div className={styles.paneHeader}>
        <PaneHeader align="right" major={true}>Commit</PaneHeader>

        {hasModifiedItems
          ? <Callout icon="asterisk" intent="warning" title="Uncommitted changes present">
              Online synchronization is paused until you commit or discard these changes.
            </Callout>
          : null}
      </div>

      {hasModifiedItems
        ? <div className={styles.paneBody}>
            {contentTypes.filter(cType => Object.keys(modifiedIds[cType]).length > 0)
            .map(cType => modifiedFileListing[cType]({
              itemIDs: modifiedIds[cType].filter(objId => allIds[cType].indexOf(objId) >= 0),
              selectedItemIDs: selectedItems[cType],
              onSelect: (objId: string) => onSelect(cType, objId),
            }))}
          </div>
        : <NonIdealState title="No uncommitted changes found" icon="tick-circle" />}

      {hasModifiedItems
        ? <footer className={styles.actionFooter}>
            <Popover minimal={true} isOpen={discardConfirmationIsOpen} content={<div className={styles.actionPrompt}>
                <div className={styles.actionFooter}>
                  <Button onClick={() => { toggleDiscardConfirmation(false) }} icon="undo">Cancel</Button>
                  <Button intent="danger" loading={discardingInProgress} onClick={handleDiscard} icon="trash">Lose changes</Button>
                </div>
              </div>}>
              <Button
                  onClick={() => { toggleDiscardConfirmation(true); toggleCommitPrompt(false); }}
                  fill={true}
                  large={true}
                  disabled={buttonsDisabled}>
                Discard selected
              </Button>
            </Popover>
            <Popover minimal={true} isOpen={commitPromptIsOpen} content={<div className={styles.actionPrompt}>
                <TextArea value={commitMessage} growVertically={true} fill={true} placeholder="Describe your changes…" onChange={handleCommitMessageChange} />
                <div className={styles.actionFooter}>
                  <Button onClick={() => { toggleCommitPrompt(false); updateCommitMessage(''); }} icon="undo">Cancel</Button>
                  <Button intent="success" loading={commitInProgress} onClick={handleCommit} icon="git-commit">Commit changes</Button>
                </div>
              </div>}>
              <Button
                  fill={true}
                  onClick={() => { toggleCommitPrompt(true); toggleDiscardConfirmation(false); }}
                  intent={!buttonsDisabled ? "primary" : undefined}
                  large={true}
                  disabled={buttonsDisabled}>
                Commit selected
              </Button>
            </Popover>
          </footer>
        : null}
    </div>
  );
};


interface ItemCardProps {
  title: string,
  isSelected: boolean,
  onSelect: () => void,
  onEdit?: () => void,
}
const ItemCard: React.FC<ItemCardProps> = function ({ title, isSelected, onSelect, onEdit }) {
  return (
    <Checkbox checked={isSelected} onChange={onSelect} inline={true}>
      <Button onClick={onEdit} icon="edit">{title}</Button>
    </Checkbox>
  );
};


export default Window;