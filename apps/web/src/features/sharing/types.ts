export type ShareTargetType = 'dataRoom' | 'folder' | 'file';

export type ShareTarget = {
  targetType: ShareTargetType;
  targetId: string;
  name: string;
};

export type PublicLink = {
  id: string;
  expiresAt: string | null;
  createdAt: string;
};

export type ShareGrant = {
  id: string;
  recipientEmail: string;
  recipientUserId: string;
  role: 'VIEWER';
  createdAt: string;
};

export type TargetShares = {
  publicLinks: PublicLink[];
  grants: ShareGrant[];
};

export type CreatedPublicLink = {
  id: string;
  targetType: ShareTargetType;
  targetId: string;
  token: string;
  createdAt: string;
};

type SharedRoom = { id: string; name: string };
type SharedFolder = { id: string; name: string; dataRoomId: string };
type SharedFile = { id: string; name: string; dataRoomId: string };

export type ReceivedShare = {
  id: string;
  dataRoomId: string | null;
  folderId: string | null;
  fileId: string | null;
  role: 'VIEWER';
  createdAt: string;
  dataRoom: SharedRoom | null;
  folder: SharedFolder | null;
  file: SharedFile | null;
};
