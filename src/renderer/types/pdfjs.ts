export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfPageProxy {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: {
    canvas?: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): { promise: Promise<void> };
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  destroy(): Promise<void>;
}

export interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: Uint8Array }): { promise: Promise<PdfDocumentProxy> };
}
