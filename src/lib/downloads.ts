export interface DownloadItem {
  id: string;
  name: string;
  description: string;
  fileName: string;
  version: string;
  size: string;
  platform: string;
  requiresKey: boolean;
  url: string;
}

export const downloads: DownloadItem[] = [
  {
    id: 'july-bypass',
    name: 'July Bypass Launcher',
    description: 'Официальный лаунчер и обход для запуска софтов July.',
    fileName: 'JulyBypass_v2.1.zip',
    version: '2.1.0',
    size: '14.2 MB',
    platform: 'Windows 10/11',
    requiresKey: true,
    url: '#',
  },
  {
    id: 'july-loader',
    name: 'July Client Loader',
    description: 'Легковесный клиент для автоматической загрузки конфигураций.',
    fileName: 'JulyLoader.exe',
    version: '1.0.5',
    size: '3.8 MB',
    platform: 'Windows 10/11',
    requiresKey: false,
    url: '#',
  },
];
