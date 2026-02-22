import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createCanvas, loadImage } from "canvas";
import { PQ } from './pq.js';
import * as AIS from './ais.js';

const IDENTIFIERS_URL = 'https://suikawiki.github.io/swcf/current/swir/list.json';

let Config = {
  image_proxy_url_prefix: "",
  sw_storage_url_prefix: 'https://wiki.suikawiki.org/n/',
};
let dataSource = new AIS.ImageDataSource (Config);
let annotationStorage = new AIS.ClassicAnnotationStorage (Config);


PQ.env.createCanvas = createCanvas;
PQ.env.createImg = async url => {
  let res = await fetch (url);
  if (res.status !== 200) throw res;
  let buffer = Buffer.from (await res.arrayBuffer ());
  let img = await loadImage (buffer);
  //img.naturalWidth = img.width;
  //img.naturalHeight = img.height;
  return img;
};



const __filename = fileURLToPath (import.meta.url);
const __dirname = path.dirname (__filename);
const indexesDir = path.join (__dirname, '..', 'local', 'indexes');
const objectsDir = path.join (__dirname, '..', 'local', 'objects');
const missingFile = path.join (indexesDir, 'missing.txt');

const isLive = process.env.LIVE;
const sizeLimit = isLive ? 1 * 1024 * 1024 * 1024 : 100 * 1024 * 1024;

function getObjectPath (id) {
  const epRegex = /^:ep-(x[A-Za-z0-9]+-[A-Za-z0-9_-]+)-([0-9a-f]+)$/;
  const match = id.match (epRegex);

  if (match && match[1].length <= 100 && match[2].length <= 100) {
    const [, group1, group2] = match;
    return path.join (objectsDir, group1, `${group2}.jpeg`);
  } // if epRegex

  const hash = crypto.createHash ('sha1').update (id).digest ('hex');
  const dir = `sha-${hash.substring (0, 2)}`;
  const filename = `${hash.substring (2)}.jpeg`;
  return path.join (objectsDir, dir, filename);
} // getObjectPath

async function fetchIdentifierItems () {
  console.error (`--> Fetching identifiers from ${IDENTIFIERS_URL}...`);
  const response = await fetch (IDENTIFIERS_URL);
  if (!response.ok) {
    throw new Error (`Failed to fetch identifiers: ${response.statusText}`);
  }
  const json = await response.json ();
  console.error (`--> Found ${Object.keys (json.items).length} identifiers.`);
  return json.items;
} // fetchIdentifierItems

function getDirectorySize (dirPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync (dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      try {
        if (file.isDirectory ()) {
          totalSize += getDirectorySize (filePath);
        } else {
          const stats = fs.statSync (filePath);
          totalSize += stats.size;
        }
      } catch (e) {
        console.error (`--> Could not stat file ${filePath}: ${e.message}. Skipping.`);
      } // catch stat
    } // for
  } catch (e) {
    if (e.code === 'ENOENT') return 0; // not an error, just empty
    throw e;
  }
  return totalSize;
} // getDirectorySize

async function processSingleItem (id, item) {
  if (!item.tags?.free) {
    return null;
  } // if not free

  let parsed = dataSource.parseImageInput (item);
  if (!parsed) {
    console.error (`--> Bad image input for ${id}. Skipping.`);
    console.error({item});
    return null;
  } // if not parsed

  const json = await annotationStorage.getAnnotationData ({ imageSource: parsed.imageSource });
  const annotationItem = json?.items?.find (_ => _.regionKey === parsed.imageRegion.key);

  if (!annotationItem) {
    console.error (`--> Annotation item not found for ${id}. Skipping.`);
    console.error({item, parsed});
    return null;
  }

  const originalParsed = parsed;
  parsed = dataSource.parseImageInput ({
    image_source: json.image,
    image_region: { region_boundary: annotationItem.regionBoundary },
  });
  if (!parsed) {
    console.error (`--> Bad input after annotation for ${id}. Skipping.`);
    console.error({item, originalParsed});
    return null;
  }
  
  try {
    const image = await dataSource.getClippedImageCanvas (parsed, { useCache: true });
    const buffer = image.toBuffer ('image/jpeg');
    const objectFile = getObjectPath (id);
    return { buffer, objectFile };
  } catch (e) {
    console.error (`--> Failed to generate image for ${id}: Skipping.`);
    console.error({item, parsed});
    console.error(e);
    return { failed: true };
  }
} // processSingleItem

async function processMirrorSet (mirrorSet) {
  console.error (`--> Processing mirror set ${mirrorSet}...`);

  const existingObjects = new Set ();
  console.error ('--> Reading all existing index files to build a comprehensive list of objects...');
  try {
    const indexFiles = fs.readdirSync (indexesDir).filter (f => f.startsWith ('list-') && f.endsWith ('.txt'));
    for (const file of indexFiles) {
      const filePath = path.join (indexesDir, file);
      const lines = fs.readFileSync (filePath, 'utf8').split ('\n').filter (Boolean);
      for (const line of lines) {
        existingObjects.add (line);
      }
    }
    console.error (`--> Found ${existingObjects.size} existing objects from ${indexFiles.length} index file(s).`);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error (`--> Error reading index directory: ${e.message}`);
    } else {
      console.error ('--> No index directory found. Starting fresh.');
    } // no ENOENT
  }

  const missingIdentifiers = new Set();
  try {
    const lines = fs.readFileSync(missingFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      missingIdentifiers.add(line);
    }
    console.error(`--> Found ${missingIdentifiers.size} missing identifiers.`);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`--> Error reading missing identifiers file: ${e.message}`);
    } else {
      console.error('--> No missing identifiers file found.');
    }
  }

  const currentIndexFile = path.join (indexesDir, `list-${mirrorSet}.txt`);
  const incomingItems = await fetchIdentifierItems ();

  let newItemsAdded = false;
  let consecutiveErrors = 0;
  const errorThreshold = 10;
  for (const [id, item] of Object.entries (incomingItems)) {
    if (existingObjects.has (id)) {
      continue;
    } // if existing

    const result = await processSingleItem (id, item);
    if (!result) {
      consecutiveErrors = 0;
      continue;
    }

    if (result.failed) {
      missingIdentifiers.add(id);
      consecutiveErrors++;
      if (consecutiveErrors >= errorThreshold) {
          console.error(`--> Aborting after ${consecutiveErrors} consecutive errors.`);
          fs.writeFileSync(missingFile, Array.from(missingIdentifiers).join('\n'), 'utf8');
          throw new Error(`Aborting due to ${consecutiveErrors} consecutive processing errors.`);
      }
      continue;
    }
    
    consecutiveErrors = 0;

    fs.mkdirSync (path.dirname (result.objectFile), { recursive: true });
    fs.writeFileSync (result.objectFile, result.buffer);

    fs.appendFileSync (currentIndexFile, `${id}\n`, 'utf8');
    existingObjects.add (id);
    missingIdentifiers.delete(id);
    newItemsAdded = true;
  } // for [id, item]

  fs.writeFileSync(missingFile, Array.from(missingIdentifiers).join('\n'), 'utf8');

  if (!newItemsAdded) {
    console.error ('--> No new items to process.');
    return;
  }

  const totalSize = getDirectorySize (objectsDir);
  console.error (`--> Total objects size: ${totalSize} bytes.`);

  if (totalSize > sizeLimit) {
    console.error (`--> Size limit (${sizeLimit} bytes) exceeded.`);
    const nextMirrorSet = parseInt (mirrorSet, 10) + 1;
    fs.writeFileSync (path.join (indexesDir, 'set.txt'), String (nextMirrorSet), 'utf8');
    console.error (`-> Set next mirror set to: ${nextMirrorSet}`);
  } // if size limit exceeded
} // processMirrorSet

async function main () {
  const mirrorSet = process.argv[2];
  if (!mirrorSet || !/^[0-9]+$/.test (mirrorSet)) {
    console.error (`Usage: node ${path.basename (__filename)} <mirror_set_id>`);
    process.exit (1);
  }

  try {
    fs.mkdirSync (indexesDir, { recursive: true });
    fs.mkdirSync (objectsDir, { recursive: true });
    await processMirrorSet (mirrorSet);
    console.error (`-> Batch process for mirror set ${mirrorSet} completed successfully.`);
  } catch (error) {
    console.error (`FATAL: ${error.message}`);
    console.error (error);
    process.exit (1);
  }
} // main

main ();

/*
 * Copyright 2026 Wakaba <wakaba@suikawiki.org>.
*
  * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * 
 */
