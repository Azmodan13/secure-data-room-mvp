export type ResourceTarget =
  | {
      type: 'dataRoom';
      id: string;
    }
  | {
      type: 'folder';
      id: string;
    }
  | {
      type: 'file';
      id: string;
    };
