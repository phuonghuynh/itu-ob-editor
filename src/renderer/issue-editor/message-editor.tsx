import React, { useContext } from 'react';

import { LangConfigContext } from 'sse/localizer/renderer';
import { NonIdealState, Classes, Text, Dialog, Button } from '@blueprintjs/core';
import { PaneHeader } from 'sse/renderer/widgets/pane-header';
import { openWindow } from 'sse/api/renderer';

import { Workspace } from 'main/storage';
import { OBIssue } from 'models/issues';
import {
  Message,
  AmendmentMessage,

  isApprovedRecommendations,
  isServiceRestrictions,
  isRunningAnnexes,
  isAmendment,
  isTelephoneService,
  isTelephoneServiceV2,
  isCallbackProcedures,
  isCustom,
} from 'models/messages';

import {
  ApprovedRecommendationsForm,
  RunningAnnexesForm,
  TelephoneServiceV2Form,
  AmendmentForm,
  ServiceRestrictionsForm,
  CBProceduresForm,
  CustomMessageForm,
} from './message-forms';

import { WorkspaceContext } from 'renderer/workspace-context';

import * as styles from './styles.scss';


/* New message prompt props. */

export interface NewMessagePromptProps {
  idx: number,
  highlight?: boolean,
  onCreate: (msg: Message) => void,
}


/* Message editor. More or less wraps message form, for which it gets the appropriate
   React class based on given message type. */

interface MessageEditorProps {
  workspace: Workspace,
  message: Message,
  issue: OBIssue,
  onChange: (updatedMessage: Message) => void,
}
export const MessageEditor: React.FC<MessageEditorProps> = function (props) {
  if (props.message) {
    const EditorCls = getMessageEditor(props.message);

    function showMessageHelp() {
      let helpPath: string;
      if (isAmendment(props.message)) {
        helpPath = "amend-publication/";
      } else {
        helpPath = `messages/${props.message.type}/`;
      }
      openWindow('help', { path: helpPath, title: "Message editing help" });
    }

    return (
      <>
        <PaneHeader align="left" className={styles.messageEditorPaneHeader}>
          <Text className="title" ellipsize={true}>
            <MessageTitle message={props.message} />
          </Text>
          <div className="actions">
            <Button minimal={true} icon="help" onClick={showMessageHelp} />
          </div>
        </PaneHeader>

        <EditorCls
          workspace={props.workspace}
          message={props.message}
          issue={props.issue}
          onChange={(updatedMessage: any) => props.onChange({ ...updatedMessage, type: props.message.type })}
        />
      </>
    );

  } else {
    return (
      <NonIdealState
        icon="error"
        title="Error loading message"
      />
    );
  }
};


/* Message form spec.

   Form implementations (React functional components) are given a ``message``
   and are expected to call ``onChange`` with updated message after user edits it.

   They are also provided ``workspace`` and ``issue`` for messages that involve
   other messages within current OB edition, or data from past editions. */

export interface MessageFormProps {
  workspace: Workspace,
  issue: OBIssue,
  message: Message,
  onChange: (updatedMessage: any) => void,
}


/* Message editor dialog.

   Some message forms invoke message editor dialog.
   TODO: Move from this to inline editing or native Electron dialog windows. #28 */

interface MessageEditorDialogProps {
  isOpen: boolean,
  onClose: () => void,
  key?: string,
  title?: string,
  width?: string,
  saveButton?: JSX.Element,
  className?: string,
}
export const MessageEditorDialog: React.FC<MessageEditorDialogProps> = function (props) {
  return (
    <Dialog
        key={props.key || "dialog"}
        title={props.title || undefined}
        isOpen={props.isOpen}
        className={props.className || styles.messageEditorDialog}
        onClose={props.onClose}
        style={props.width ? { width: props.width } : {}}
      >
      <div className={Classes.DIALOG_BODY}>
        {props.children}
      </div>

      {props.saveButton
        ? <div className={Classes.DIALOG_FOOTER}>
            {props.saveButton}
          </div>
        : ''}
    </Dialog>
  );
};


/* Utility functions */

export const MessageTitle: React.FC<{ message: Message }> = ({ message }) => {
  const workspace = useContext(WorkspaceContext);
  const lang = useContext(LangConfigContext);

  if (isApprovedRecommendations(message)) {
    return <>Approved Recommendations</>;
  } else if (isRunningAnnexes(message)) {
    return <>Lists Annexed</>;
  } else if (isTelephoneServiceV2(message)) {
    return <>Telephone Service</>;
  } else if (isTelephoneService(message)) {
    return <>Telephone Service (old)</>;
  } else if (isCallbackProcedures(message)) {
    return <>Call-back and Alternative Calling Procedures</>;
  } else if (isCustom(message)) {
    const title = (message.title || {})[lang.default] || '';
    if (title) {
      return <><small title="Custom message">Cust.</small>&ensp;{title}</>;
    } else {
      return <>Custom message</>;
    }
  } else if (isAmendment(message)) {
    const pubId = ((message as AmendmentMessage).target || {}).publication;
    const pub = workspace.current.publications[pubId];
    if (pub) {
      return <><small title="Amendment to publication">Amd.&nbsp;to</small>&ensp;{pub.title[lang.default]}</>;
    } else {
      return <>Amendment</>;
    }
  } else if (isServiceRestrictions(message)) {
    return <>Service Restrictions</>;
  } else {
    return <em>unknown message {message.type}</em>;
  }
}

function getMessageEditor(msg: Message): React.FC<MessageEditorProps> {
  if (isApprovedRecommendations(msg)) {
    return ApprovedRecommendationsForm;
  } else if (isRunningAnnexes(msg)) {
    return RunningAnnexesForm;
  } else if (isTelephoneServiceV2(msg)) {
    return TelephoneServiceV2Form;
  } else if (isServiceRestrictions(msg)) {
    return ServiceRestrictionsForm;
  } else if (isAmendment(msg)) {
    return AmendmentForm;
  } else if (isCallbackProcedures(msg)) {
    return CBProceduresForm;
  } else if (isCustom(msg)) {
    return CustomMessageForm;
  } else {
    return () => (
      <NonIdealState
        icon="heart-broken"
        title={`“${msg.type}” messages aren’t supported yet`}
        description="Sorry about that."
      />
    );
    //throw new Error("Unknown message type");
  }
}
