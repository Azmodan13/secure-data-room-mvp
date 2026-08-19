export type Folder = {
  id: string;
  dataRoomId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type FolderResponse = {
  data: Folder;
};

export type CreateFolderInput = {
  dataRoomId: string;
  parentId: string | null;
  name: string;
};

export type FolderBreadcrumb = {
  id: string;
  name: string;
};

export type FolderBreadcrumbsResponse = {
  data: FolderBreadcrumb[];
};
