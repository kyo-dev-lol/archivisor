declare module 'seek-bzip' {
  interface Bunzip {
    decode(input: Uint8Array | ArrayBuffer, expectedSizeOrOutput?: number, multistream?: boolean): Uint8Array;
  }
  const Bunzip: Bunzip;
  export default Bunzip;
}
