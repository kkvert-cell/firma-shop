// Назви підбірок для головної (окремий файл, щоб клієнтські й серверні компоненти не тягнули базу даних)
export const COLLECTION_TITLES = { sale: "Акції", hits: "Хіти продажів", new: "Новинки" } as const;
export const COLLECTION_ALL_LABELS = { sale: "Усі акції", hits: "Усі хіти", new: "Усі новинки" } as const;
