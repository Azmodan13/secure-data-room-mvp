export type DataRoom = {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PageInfo = {
  hasMore: boolean;
  nextCursor: string | null;
};

export type DataRoomsResponse = {
  data: DataRoom[];
  page: PageInfo;
};

export type FolderItem = {
  type: 'folder';
  id: string;
  dataRoomId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type FileItem = {
  type: 'file';
  id: string;
  dataRoomId: string;
  folderId: string | null;
  name: string;
  sizeBytes: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
};

export type DataRoomItem = FolderItem | FileItem;

export type DataRoomResponse = {
  data: DataRoom;
};

export type DataRoomItemsResponse = {
  data: DataRoomItem[];
  page: PageInfo;
};
