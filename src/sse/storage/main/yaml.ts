import * as yaml from 'js-yaml';
import { customTimestampType } from './yaml-custom-ts';


export class YAMLStorage {
  constructor(private fs: any) { }

  public async load(filePath: string): Promise<any> {
    const data: string = await this.fs.readFile(filePath, { encoding: 'utf8' });
    return yaml.load(data, { schema: SCHEMA });
  }

  public async store(filePath: string, data: any): Promise<any> {
    // Merge new data into old data; this way if some YAML properties
    // are not supported we will not lose them after the update.
    let fileExists: boolean;
    let oldData: any;
    try {
      fileExists = (await this.fs.stat(filePath)).isFile() === true;
    } catch (e) {
      fileExists = false;
    }
    if (fileExists) {
      oldData = await this.load(filePath);
    } else {
      oldData = {};
    }
    const newData: any = Object.assign({}, oldData, data);

    // console.debug(`Dumping contents for ${filePath} from ${data}`);
    // console.debug(oldData);

    const newContents: string = yaml.dump(newData, {
      schema: SCHEMA,
      noRefs: true,
      noCompatMode: true,
    });

    // console.debug(`Writing to ${filePath}, file exists: ${fileExists}`);

    // if (fileExists) {
    //   const oldContents: string = await this.fs.readFile(filePath, { encoding: 'utf8' });
    //   console.debug(`Replacing contents of ${filePath}`, oldContents, newContents);
    // }

    await this.fs.writeFile(filePath, newContents, { encoding: 'utf8' });
    return data;
  }
}


const SCHEMA = new yaml.Schema({
  include: [yaml.DEFAULT_SAFE_SCHEMA],

  // Trick because js-yaml API appears to not support augmenting implicit tags
  implicit: [
    ...(yaml.DEFAULT_SAFE_SCHEMA as any).implicit,
    ...[customTimestampType],
  ],
});