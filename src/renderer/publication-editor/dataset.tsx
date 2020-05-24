import update from 'immutability-helper';
import React, { useContext } from 'react';
import { DndProvider } from 'react-dnd';
import Backend from 'react-dnd-html5-backend';
import { FormGroup, InputGroup, Button, ControlGroup, HTMLSelect } from '@blueprintjs/core';
import { LangConfigContext } from 'coulomb/localizer/renderer/context';
import { DataItem, Dataset, DataObject, DataArray, BasicField, DataType } from 'models/dataset';
import { EditorViewProps } from './types';
import Sortable from 'renderer/widgets/dnd-sortable';
import styles from './styles.scss';


interface DatasetMetaEditorProps extends EditorViewProps<Dataset> {}


const DatasetMeta: React.FC<DatasetMetaEditorProps> = function ({ obj, onChange }) {
  const dataset = obj;
  const lang = useContext(LangConfigContext);
  return (
    <div className={styles.datasetSpecEditor}>
      <div className={styles.datasetBasics}>
        <FormGroup label="Dataset title:">
          <InputGroup
            value={dataset.title ? dataset.title[lang.selected] : ''}
            onChange={(evt: React.FormEvent<HTMLInputElement>) => {
              const newTitle = evt.currentTarget.value as string;
              if (newTitle.trim() !== '') {
                onChange({ ...obj, title: { ...obj.title, [lang.selected]: newTitle } });
              } else {
                var title = { ...obj.title || {} };
                if (Object.keys(title).length > 0 && title[lang.selected]) {
                  delete title[lang.selected];
                  onChange({ ...obj, title });
                }
                if (Object.keys(title).length < 1) {
                  var newObj = { ...obj };
                  delete newObj.title;
                  onChange(newObj);
                }
              }
            }}
          />
        </FormGroup>

        <FormGroup
            label="Dataset structure:"
            inline
            helperText={<>
              {obj.type === 'array' ? "Items are in an ordered list." : null}
              {obj.type === 'index' ? "Each item is assigned a key." : null}
              {" "}
              Specify item fields below.
            </>}>
          <DataTypeSelector
            allowedTypes={['index', 'array']}
            selectedType={obj.type}
            className={styles.datasetType}
            onChange={onChange
              ? ((typ) => {
                if (typ === 'array' || typ === 'index') {
                  onChange({ ...obj, type: typ } as Dataset)
                }
              })
              : undefined} />
        </FormGroup>

      </div>

      <DndProvider backend={Backend}>
        <DataObjectSpec
          obj={obj.item}
          onChange={(newItem) => onChange({ ...obj, item: newItem })}
          nestingLevel={0} />
      </DndProvider>
    </div>
  );
};


const FIELD_TYPES: DataItem["type"][] = ['text', 'translated-text', 'number', 'boolean'];
const COMPLEX_FIELD_TYPES: DataItem["type"][] = ['array', 'object'];


interface DataObjectSpecProps {
  obj: DataObject
  onChange?: (updatedObj: DataObject) => void
  allowedFieldTypes?: DataItem["type"][]
  nestingLevel: number
}
const DataObjectSpec: React.FC<DataObjectSpecProps> =
function ({ obj, onChange, nestingLevel, allowedFieldTypes }) {
  const lang = useContext(LangConfigContext);

  const NEW_SIMPLE_FIELD: DataItem & BasicField = {
    id: `field_${obj.fields.length + 1}`,
    type: 'text',
    required: true,
    label: { [lang.default]: `Field ${obj.fields.length + 1}` },
  };

  function moveField(dragIndex: number, hoverIndex: number) {
    if (onChange && dragIndex !== undefined) {
      const dragItem = obj.fields[dragIndex];
      onChange({
        ...obj,
        fields: update(obj.fields, { $splice: [[dragIndex, 1], [hoverIndex, 0, dragItem]] }),
      });
    }
  }

  function deleteField(idx: number) {
    if (onChange) {
      onChange({
        ...obj,
        fields: update(obj.fields, { $splice: [[idx, 1]] }),
      });
    }
  }

  function updateField(idx: number, newField: DataItem & BasicField) {
    if (onChange) {
      var fields = [ ...obj.fields ];
      fields[idx] = newField;
      onChange({ ...obj, fields });
    }
  }

  function appendField() {
    if (onChange) {
      const newObj: DataObject = {
        ...obj,
        fields: [ ...obj.fields, NEW_SIMPLE_FIELD ],
      };
      onChange(newObj);
    }
  }

  return (
    <FormGroup>
      {[ ...obj.fields.entries() ].map(([idx, field]) =>
        field !== undefined
        ? <Sortable
              key={(obj.fields || []).indexOf(field)}
              idx={idx}
              canReorder={onChange !== undefined}
              itemType={`${nestingLevel}-field`}
              onReorder={moveField}
              className={styles.datasetFieldSortable}
              handleIcon="menu">
            <DataFieldSpec
              field={field}
              nestingLevel={nestingLevel + 1}
              allowedTypes={allowedFieldTypes}
              onDelete={onChange ? (() => deleteField(idx)) : undefined}
              onChange={onChange ? ((newField) => updateField(idx, newField)) : undefined} />
          </Sortable>
        : null
      )}
      <div className={styles.datasetNewField}>
        <Button onClick={appendField} icon="add">Add field</Button>
      </div>
    </FormGroup>
  );
};


interface DataFieldSpecProps {
  field: DataItem & BasicField
  allowedTypes?: DataItem["type"][]
  onChange?: (updatedField: DataItem & BasicField) => void
  onDelete?: () => void
  nestingLevel: number 
}
const DataFieldSpec: React.FC<DataFieldSpecProps> =
function ({ field, onChange, onDelete, nestingLevel, allowedTypes }) {
  const typeOptions: DataItem["type"][] = allowedTypes || [ ...FIELD_TYPES, ...COMPLEX_FIELD_TYPES ];

  const lang = useContext(LangConfigContext);
  const defaultObjectField: DataItem & BasicField = {
    type: 'text',
    label: { [lang.selected]: "Object ID" },
    id: 'id',
    required: true,
  };

  let fieldEditor: JSX.Element | null;
  if (field.type === 'array') {
    fieldEditor = (
      <DataObjectSpec
        obj={field.item}
        nestingLevel={nestingLevel}
        onChange={onChange
          ? ((newObj) => onChange({ ... field, item: newObj }))
          : undefined}
      />
    );
  } else if (field.type === 'object') {
    fieldEditor = (
      <DataObjectSpec
        obj={field}
        nestingLevel={nestingLevel}
        onChange={onChange
          ? ((newObj) => onChange({ ... field, ...newObj }))
          : undefined}
      />
    );
  } else {
    fieldEditor = null;
  }

  return (
    <div className={styles.datasetField}>
      <FormGroup className={styles.datasetFieldBasics}>
        <ControlGroup fill>
          <InputGroup
            type="text"
            value={field.id}
            placeholder="Unique ID for this field"
            onChange={onChange
              ? (evt: React.FormEvent<HTMLInputElement>) =>
                onChange({
                  ...field,
                  id:  evt.currentTarget.value as string,
                })
              : undefined} />

          <InputGroup
            type="text"
            fill
            value={field.label[lang.selected]}
            placeholder={`Field label (${lang.available[lang.selected]}`}
            onChange={onChange
              ? (evt: React.FormEvent<HTMLInputElement>) =>
                onChange({
                  ...field,
                  label: {
                    ...field.label,
                    [lang.selected]: evt.currentTarget.value as string,
                  }
                })
              : undefined} />

          <DataTypeSelector
            allowedTypes={typeOptions}
            selectedType={field.type}
            onChange={onChange
              ? ((typ) => {
                  if (typ === 'object') {
                    const newField: DataObject & BasicField = { ...field, type: typ, fields: [defaultObjectField] };
                    onChange(newField);
                  } else if (typ === 'array') {
                    const newField: DataArray & BasicField = { ...field, type: typ, item: { type: 'object', fields: [defaultObjectField] }};
                    onChange(newField)
                  } else if (typ === 'index') {
                    throw new Error("Index structures are not allowed beyond top-level dataset");
                  } else {
                    onChange({ ...field, type: typ } as DataItem & BasicField);
                  }
                })
              : undefined} />

          <Button
              active={field.required === true}
              disabled={!onChange}
              title="Is this field mandatory (required) when entering data?"
              onClick={onChange
                ? (() => onChange({ ...field, required: !field.required || undefined }))
                : undefined}>
            req.
          </Button>

          <Button
            disabled={!onChange}
            onClick={onDelete}
            icon="delete"
            title="Delete this field." />
        </ControlGroup>
      </FormGroup>

      {fieldEditor}
    </div>
  );
};


interface DataTypeSelectorProps {
  allowedTypes: DataType[] 
  selectedType?: DataType
  onChange?: (type: DataType) => void
  className?: string
}
const DataTypeSelector: React.FC<DataTypeSelectorProps> =
function ({ allowedTypes, selectedType, onChange, className }) {
  return (
    <HTMLSelect
      className={className}
      options={allowedTypes.map(typ => ({ label: typ, value: typ }))}
      value={selectedType}
      onChange={onChange
        ? (evt: React.FormEvent<HTMLSelectElement>) => {
            const typ = evt.currentTarget.value as DataType;
            if (typ !== selectedType && allowedTypes.indexOf(typ) >= 0) {
              onChange(typ);
            }
          }
        : undefined}
    />
  );
};


export default DatasetMeta;