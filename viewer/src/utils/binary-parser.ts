import {Parser} from 'binary-parser';


export interface RGBColor {
  R: number;
  G: number;
  B: number;
}

export interface PoseLimb {
  from: number;
  to: number;
}

interface PoseHeaderComponentModel {
  name: string;
  format: string;
  _points: number;
  _limbs: number;
  _colors: number;
  points: string[];
  limbs: PoseLimb[],
  colors: RGBColor[]
}

export interface PoseHeaderModel {
  version: number,
  width: number,
  height: number,
  depth: number,
  _components: number,
  components: PoseHeaderComponentModel[],
  headerLength: number
}

export interface PosePointModel {
  X: number;
  Y: number;
  Z?: number;
  C?: number;
}

export interface PoseBodyFramePersonModel {
  [key: string]: PosePointModel[];
}

export interface PoseBodyFrameModel {
  _people: number;
  people: PoseBodyFramePersonModel[]
}

export interface PoseBodyModel {
  _frames: number,
  frames: PoseBodyFrameModel[]
}

export interface PoseModel {
  header: PoseHeaderModel,
  body: PoseBodyModel
}

function newParser() {
  return new Parser().endianess("little");
}

function componentHeaderParser() {
  const limbParser = newParser()
    .uint16("from")
    .uint16("to");
  const colorParser = newParser()
    .uint16("R")
    .uint16("G")
    .uint16("B");

  const strParser = newParser()
    .string("text", {zeroTerminated: true});


  return newParser()
    .string("name", {zeroTerminated: true})
    .string("format", {zeroTerminated: true})
    .uint16("_points")
    .uint16("_limbs")
    .uint16("_colors")
    .array("points", {
      type: strParser,
      formatter: (arr: any[]) => arr.map(item => item.text),
      length: "_points"
    })
    .array("limbs", {
      type: limbParser,
      length: "_limbs"
    })
    .array("colors", {
      type: colorParser,
      length: "_colors"
    });
}

function getHeaderParser() {
  const componentParser = componentHeaderParser();

  return newParser()
    .floatle("version")
    .uint16("width")
    .uint16("height")
    .uint16("depth")
    .uint16("_components")
    .array("components", {
      type: componentParser,
      length: "_components"
    })
    // @ts-ignore
    .saveOffset('headerLength')
}


function getBodyParser(header: PoseHeaderModel) {
  let personParser: any = newParser()
    .int16("id");
  header.components.forEach(component => {
    let pointParser: any = newParser();
    Array.from(component.format).forEach(c => {
      pointParser = pointParser.floatle(c);
    });

    personParser = personParser.array(component.name, {
      "type": pointParser,
      "length": component._points
    });
  });

  const frameParser = newParser()
    .uint16("_people")
    .array("people", {
      type: personParser,
      length: "_people"
    });

  return newParser()
    .seek(header.headerLength)
    .uint16("_frames")
    .array("frames", {
      type: frameParser,
      length: "_frames"
    })
}


const headerParser = getHeaderParser();

export function parsePose(buffer: Buffer): PoseModel {
  const header = headerParser.parse(buffer) as unknown as PoseHeaderModel;
  const body = getBodyParser(header).parse(buffer) as unknown as PoseBodyModel;

  return {header, body};
}
