import * as path from 'path';

import { makeEndpoint } from 'sse/api/main';

import { Index, IndexableObject } from '../query';
import { Workspace } from '../workspace';

import { YAMLStorage } from './yaml';


const YAML_EXT = '.yaml';


export abstract class StoreManager<O extends IndexableObject> {
  private _index: Index<O> | undefined = undefined;

  constructor(public rootDir: string) {}

  public async storeIndex(storage: Storage<any>, newIdx: Index<O> | undefined): Promise<boolean> {
    const idx: Index<O> = newIdx || await this.getIndex(storage);
    const items: O[] = Object.values(idx);

    for (const obj of items) {
      await this.store(obj, storage);
    }
    return true;
  }

  public async getIndex(storage: Storage<any>): Promise<Index<O>> {
    if (this._index === undefined) {
      this._index = await this._loadIndex(storage);
    }
    return this._index;
  }

  public async findObjects(storage: Storage<any>, query?: string): Promise<Index<O>> {
    const index = await this.getIndex(storage);
    if (query !== undefined) {
      var results: Index<O> = {};
      for (let key of Object.keys(index)) {
        const obj = index[key]
        if (this.objectMatchesQuery(obj, query)) {
          results[key] = obj;
        }
      }
      return results;
    } else {
      return index;
    }
  }

  private async _loadIndex(storage: Storage<any>): Promise<Index<O>> {
    const rootPath = this.rootDir;
    const dirs = await storage.fs.readdir(path.join(storage.workDir, rootPath));
    const idx: Index<O> = {};

    for (const dir of dirs) {
      if (dir != '.DS_Store') {
        const objData = await storage.loadObject(path.join(rootPath, dir));
        if (objData) {
          const obj: O = this.postLoad(objData);
          idx[obj.id] = obj;
        }
      }
    }
    return idx;
  }

  // TODO: Use methods `toStoreableObject(obj: O) => any` & `toUseableObject(data: any) => O`
  // to prepare object for storage & post-process loaded data

  // Stores object in DB
  public abstract async store(obj: O, storage: Storage<any>): Promise<boolean>;

  // Converts object data into valid object, if needed
  // (in cases when partial data is stored or migration took place previously)
  public postLoad(obj: any): O {
    return obj as O;
  }

  public objectMatchesQuery(obj: O, query: string): boolean {
    return false;
  }
}


export abstract class Storage<W extends Workspace> {
  public yaml: YAMLStorage;
  public workspace: W;

  constructor(public fs: any, public workDir: string,
      public storeManagers: { [key: string]: StoreManager<any> }) {
    this.fs = fs;
    this.workDir = workDir;
    this.yaml = new YAMLStorage(fs);

    this.workspace = Object.keys(storeManagers).reduce((obj: any, key: string) => {
      obj[key] = {};
      return obj;
    }, {}) as W;
  }

  public abstract async findObjects(query?: string): Promise<W>
  public abstract async loadWorkspace(): Promise<W>

  async storeWorkspace(): Promise<boolean> {
    return Promise.all([...Object.keys(this.storeManagers).map(async (key) => {
      return await this.storeManagers[key].storeIndex(this, this.workspace[key]);
    })]).then(this.loadWorkspace.bind(this)).then(() => true);
  }

  // Loads object data from given directory, reading YAML files.
  // meta.yaml is treated specially, populating top-level object payload.
  // Other YAML files populate corresponding object properties.
  public async loadObject(objDir: string): Promise<any | undefined> {
    let objData: {[propName: string]: any};

    const metaFile = path.join(this.workDir, objDir, 'meta.yaml');
    let metaFileIsFile: boolean;
    try {
      metaFileIsFile = (await this.fs.stat(metaFile)).isFile();
    } catch (e) {
      return undefined;
    }
    if (!metaFileIsFile) {
      return undefined;
    }
    objData = await this.yaml.load(metaFile);

    const dirContents = await this.fs.readdir(path.join(this.workDir, objDir));
    for (const item of dirContents) {
      if (path.extname(item) == YAML_EXT) {
        const basename = path.basename(item, YAML_EXT);
        if (basename != 'meta') {
          objData[basename] = await this.yaml.load(path.join(this.workDir, objDir, item));
        }
      }
    }

    // Blindly hope that data structure loaded from YAML
    // is valid for given type.
    return objData;
  }

  setUpAPIEndpoints() {
    for (let indexName of Object.keys(this.workspace)) {
      makeEndpoint<Index<any>>(`storage-${indexName}-all`, async (newIndex?: Index<any>) => {
        if (newIndex) {
          await this.storeManagers[indexName].storeIndex(this, newIndex);
          await this.loadWorkspace();
        }
        return this.workspace[indexName];
      });
      makeEndpoint<IndexableObject>(`storage-${indexName}`, async ({ objectId }: { objectId: string }, newObject?: IndexableObject) => {
        if (newObject) {
          await this.storeManagers[indexName].store(newObject, this);
          await this.loadWorkspace();
        }
        return this.workspace[indexName][objectId];
      });
      makeEndpoint<boolean>(`storage-${indexName}-delete`, async ({ objectId }: { objectId: string }) => {
        delete this.workspace[indexName][objectId];
        await this.storeManagers[indexName].storeIndex(this, this.workspace[indexName]);
        await this.loadWorkspace();
        return true;
      });
    }
  }
}
