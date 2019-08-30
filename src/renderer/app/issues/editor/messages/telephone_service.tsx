import React, { useState } from 'react';
import { H4, Card, Label, Button, FormGroup, InputGroup, TextArea } from '@blueprintjs/core';
import { DatePicker } from '@blueprintjs/datetime';

import {
  TSCommunication,
  TSCountryCommunicationSet,
  TelephoneServiceMessage,
} from 'main/issues/messages/telephone_service';

import { DateStamp } from 'renderer/app/dates';

import { FreeformContents } from '../freeform-contents';
import { MessageEditorProps, MessageEditorDialog } from '../message-editor';

import * as styles from '../styles.scss';


function getNewCommStub(): TSCommunication {
  return {
    date: new Date(),
    contents: {},
  };
}


function getNewCountryStub(): TSCountryCommunicationSet {
  return {
    country_name: '',
    phone_code: '',
    contact: '',
    communications: [],
  };
}


export const TelephoneServiceMessageEditor: React.FC<MessageEditorProps> = function ({ message, onChange }) {
  var countryCommSets = (message as TelephoneServiceMessage).contents;

  const [activeCountryIdx, setActiveCountryIdx] = useState(0);
  const [activeCommIdx, setActiveCommIdx] = useState(0);
  const [newCountryDialogState, toggleNewCountryDialogState] = useState(false);
  const [editCountryDialogState, toggleEditCountryDialogState] = useState(false);
  const [newCommDialogState, toggleNewCommDialogState] = useState(false);
  const [editCommDialogState, toggleEditCommDialogState] = useState(false);

  function _onChange() {
    onChange(Object.assign({}, (message as TelephoneServiceMessage), { contents: countryCommSets }));
  }

  function updateCommunication(countryIdx: number, commIdx: number, updatedComm: TSCommunication) {
    countryCommSets = countryCommSets.map((countryCommSet: TSCountryCommunicationSet, _idx: number) => {
      if (countryIdx === _idx) {
        countryCommSet.communications = countryCommSet.communications.map((comm: TSCommunication, _idx: number) => {
          if (_idx === commIdx) {
            return updatedComm;
          } else {
            return comm;
          }
        });
      }
      return countryCommSet;
    });
  }

  return (
    <>
      <AddCountryPrompt
        key="addFirstCountry"
        onOpen={() => {
          setActiveCountryIdx(0);
          toggleNewCountryDialogState(true);
        }}
      />

      {countryCommSets.length > 0
        ? countryCommSets.map((countryCommSet: TSCountryCommunicationSet, countryIdx: number) => (
          <>
            <Card className={styles.tsCountryCommunicationSet} key={countryIdx}>
              <H4>
                {countryCommSet.country_name}
                &nbsp;
                (country code +{countryCommSet.phone_code})
              </H4>

              <div className={styles.tsCountryButtons}>
                <EditCountryPrompt
                  key="editCountry"
                  title={<>Edit country details & contact info</>}
                  onOpen={() => {
                    setActiveCountryIdx(countryIdx);
                    toggleEditCountryDialogState(true);
                  }}
                />

                <span>
                  <Button
                    icon="delete"
                    small={true}
                    minimal={true}
                    intent="danger"
                    onClick={() => {
                      countryCommSets.splice(countryIdx, 1);
                      _onChange();
                    }}>Delete country</Button>

                  <AddCommunicationPrompt
                    key="addFirstComm"
                    onOpen={() => {
                      setActiveCountryIdx(countryIdx);
                      setActiveCommIdx(0);
                      toggleNewCommDialogState(true);
                    }}
                  />
                </span>
              </div>

              <div className={styles.tsCommunicationList}>
                {countryCommSet.communications.length > 0
                  ? countryCommSet.communications.map((comm: TSCommunication, commIdx: number) => (
                    <>
                      <article className={styles.tsCommunication} key={commIdx}>
                        <EditCommunicationPrompt
                          key="editComm"
                          title={<>Edit communication of <DateStamp date={comm.date} /></>}
                          onOpen={() => {
                            setActiveCountryIdx(countryIdx);
                            setActiveCommIdx(commIdx);
                            toggleEditCommDialogState(true);
                          }}
                        />
                        <AddCommunicationPrompt
                          key="addCommAfter"
                          onOpen={() => {
                            setActiveCountryIdx(countryIdx);
                            setActiveCommIdx(commIdx + 1);
                            toggleNewCommDialogState(true);
                          }}
                        />
                      </article>
                    </>))
                  : ''}
              </div>
            </Card>

            <AddCountryPrompt
              key={`addCountryAfter-${countryIdx}`}
              onOpen={() => {
                setActiveCountryIdx(countryIdx + 1);
                toggleNewCountryDialogState(true);
              }}
            />
          </>
        ))
        : ''}

      {newCountryDialogState === true 
        ? <EditCountryDialog
            key="addCountry"
            title="Add country"
            countryCommSet={getNewCountryStub()}
            isOpen={true}
            onClose={() => toggleNewCountryDialogState(false)}
            onSave={(countryCommSet: TSCountryCommunicationSet) => {
              countryCommSets.splice(activeCountryIdx, 0, countryCommSet);
              _onChange();
              toggleNewCountryDialogState(false);
            }}
          />
        : ''}

      {editCountryDialogState === true && countryCommSets[activeCountryIdx] !== undefined
        ? <EditCountryDialog
            key="editCountry"
            title="Edit country"
            countryCommSet={countryCommSets[activeCountryIdx]}
            isOpen={true}
            onClose={() => toggleEditCountryDialogState(false)}
            onSave={(countryCommSet) => {
              countryCommSets[activeCountryIdx].phone_code = countryCommSet.phone_code;
              countryCommSets[activeCountryIdx].country_name = countryCommSet.country_name;
              countryCommSets[activeCountryIdx].contact = countryCommSet.contact;
              _onChange();
              toggleEditCountryDialogState(false);
            }}
          />
        : ''}

      {newCommDialogState === true
        ? <EditCommunicationDialog
            key="addCommunication"
            title="Add communication"
            comm={getNewCommStub()}
            isOpen={true}
            onClose={() => toggleNewCommDialogState(false)}
            onSave={(comm) => {
              countryCommSets[activeCountryIdx].communications.splice(activeCommIdx, 0, comm);
              _onChange();
              toggleNewCommDialogState(false);
            }}
          />
        : ''}

      {editCommDialogState === true && ((countryCommSets[activeCountryIdx] || {}).communications || [])[activeCommIdx] !== undefined
        ? <EditCommunicationDialog
            key="editCommunication"
            title={`Edit communication ${activeCommIdx + 1}`}
            comm={countryCommSets[activeCountryIdx].communications[activeCommIdx]}
            isOpen={true}
            onClose={() => toggleEditCommDialogState(false)}
            onSave={(comm) => {
              updateCommunication(activeCountryIdx, activeCommIdx, comm);
              _onChange();
              toggleEditCommDialogState(false);
            }}
          />
        : ''}

    </>
  );
};


/* Prompts */


interface AddCountryPromptProps {
  onOpen: () => void,
  title?: JSX.Element,
}
const AddCountryPrompt: React.FC<AddCountryPromptProps> = function ({ onOpen, title }) {
  return (
    <Button
      className={styles.addCountryTrigger}
      minimal={true}
      icon="plus"
      small={true}
      onClick={onOpen}>Add country</Button>
  );
};


interface EditCountryPromptProps {
  onOpen: () => void,
  title?: JSX.Element,
}
const EditCountryPrompt: React.FC<EditCountryPromptProps> = function ({ onOpen, title }) {
  return (
    <Button icon="edit" small={true} minimal={true} onClick={onOpen} title="Edit country details">
      {title}
    </Button>
  );
};


interface AddCommunicationPromptProps {
  onOpen: () => void,
  title?: JSX.Element,
}
const AddCommunicationPrompt: React.FC<AddCommunicationPromptProps> = function ({ onOpen, title }) {
  return (
    <Button icon="plus" small={true} minimal={true} onClick={onOpen} title="Add communication">
      {title}
    </Button>
  );
};


interface EditCommunicationPromptProps {
  onOpen: () => void,
  title?: JSX.Element,
}
const EditCommunicationPrompt: React.FC<EditCommunicationPromptProps> = function ({ onOpen, title }) {
  return (
    <Button icon="edit" small={true} minimal={true} onClick={onOpen} title="Edit communication">
      {title}
    </Button>
  );
};


/* Dialogs */


interface EditCountryDialogProps {
  isOpen: boolean,
  countryCommSet: TSCountryCommunicationSet,
  title: string,
  onSave: (countryCommSet: TSCountryCommunicationSet) => void,
  onClose: () => void,
}
const EditCountryDialog: React.FC<EditCountryDialogProps> = function ({ isOpen, countryCommSet, title, onSave, onClose }) {
  const [countryName, setCountryName] = useState(countryCommSet.country_name);
  const [phoneCode, setPhoneCode] = useState(countryCommSet.phone_code);
  const [contactInfo, setContactInfo] = useState(countryCommSet.contact);

  function _onSave() {
    if (countryName != '' && phoneCode != '' && contactInfo != '') {
      onSave({
        country_name: countryName,
        phone_code: phoneCode,
        contact: contactInfo,
        communications: countryCommSet.communications,
      });
      onClose();
    }
  }

  // A country with a single communication is a common case.
  // TODO: We should allow authors to add first communication
  // while they’re adding the country, instead of requiring to use
  // another dialog.
  return (
    <>
      <MessageEditorDialog
          title={title}
          isOpen={isOpen}
          onClose={onClose}
          saveButton={
            <Button intent="primary" onClick={_onSave}>Save country</Button>
          }>
        <TSCountryDetailsEditor
          countryName={countryName}
          phoneCode={phoneCode}
          contactInfo={contactInfo}
          onChange={(countryName: string, phoneCode: string, contactInfo: string) => {
            setCountryName(countryName);
            setPhoneCode(phoneCode);
            setContactInfo(contactInfo);
          }}
        />
      </MessageEditorDialog>
    </>
  );
};


interface EditCommunicationDialogProps {
  isOpen: boolean,
  comm: TSCommunication,
  title: string,
  onSave: (comm: TSCommunication) => void,
  onClose: () => void,
}
const EditCommunicationDialog: React.FC<EditCommunicationDialogProps> = function ({ isOpen, comm, title, onSave, onClose }) {
  const [commDate, setCommDate] = useState(comm.date);
  const [commContents, setCommContents] = useState(comm.contents);

  function _onSave() {
    onSave({ date: commDate, contents: commContents });
    onClose();
  }

  return (
    <MessageEditorDialog
        title={title}
        isOpen={isOpen}
        onClose={onClose}
        saveButton={
          <Button intent="primary" onClick={_onSave}>Save communication</Button>
        }>
      <TSCountryCommunicationDetailsEditor
        date={commDate}
        contents={commContents}
        onChange={(date: Date, contents: any) => {
          setCommDate(date);
          setCommContents(contents);
        }}
      />
    </MessageEditorDialog>
  );
};


/* Editors */


interface TSCountryCommunicationDetailsEditorProps {
  date: Date,
  contents: any,
  onChange: (newDate: Date, newContents: any) => void,
}
const TSCountryCommunicationDetailsEditor: React.FC<TSCountryCommunicationDetailsEditorProps> =
    function ({ date, contents, onChange }) {

  const [newDate, setDate] = useState(date);
  var newContents = Object.assign({}, contents);

  function _onChange() {
    onChange(newDate, newContents);
  }

  return (
    <div className={styles.tsCountryCommunicationEditor}>
      <FormGroup
          label="Communication date"
          intent="primary">
        <DatePicker
          key="datePicker"
          canClearSelection={false}
          value={newDate}
          onChange={(val: Date) => {
            setDate(val);
            _onChange();
          }}
        />
      </FormGroup>

      <FormGroup
          label="Communication contents"
          intent="primary">
        <Card>
          <FreeformContents
            doc={newContents}
            onChange={(updatedDoc) => {
              Object.keys(newContents).forEach(function(key) { delete newContents[key]; });
              Object.assign(newContents, JSON.parse(JSON.stringify(updatedDoc, null, 2)));
              _onChange();
            }}
          />
        </Card>
      </FormGroup>
    </div>
  );
};


interface TSCountryDetailsEditorProps {
  countryName: string,
  phoneCode: string,
  contactInfo: string,
  onChange: (newCountryName: string, newPhoneCode: string, newContactInfo: string) => void,
}
const TSCountryDetailsEditor: React.FC<TSCountryDetailsEditorProps> =
    function ({ countryName, phoneCode, contactInfo, onChange }) {

  const [newCountryName, setCountryName] = useState(countryName);
  const [newPhoneCode, setPhoneCode] = useState(phoneCode);
  const [newContactInfo, setContactInfo] = useState(contactInfo);

  function _onChange() {
    onChange(newCountryName, newPhoneCode, newContactInfo);
  }

  return (
    <>

      <Label>
        Country name
        <InputGroup
          value={newCountryName}
          key="countryName"
          type="text"
          large={true}
          onChange={(evt: React.FormEvent<HTMLElement>) => {
            setCountryName((evt.target as HTMLInputElement).value as string);
            _onChange();
          }}
        />
      </Label>

      <Label>
        Phone code
        <InputGroup
          value={newPhoneCode}
          key="phoneCode"
          type="text"
          large={true}
          onChange={(evt: React.FormEvent<HTMLElement>) => {
            setPhoneCode((evt.target as HTMLInputElement).value as string);
            _onChange();
          }}
        />
      </Label>

      <Label>
        Contact info
        <TextArea
          value={newContactInfo}
          key="contactInfo"
          onChange={(evt: React.FormEvent<HTMLElement>) => {
            setContactInfo((evt.target as HTMLInputElement).value as string);
            _onChange();
          }}
        />
      </Label>

    </>
  );
};
