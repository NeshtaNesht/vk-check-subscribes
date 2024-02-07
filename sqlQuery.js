export const selectLastMaxId =
  "SELECT * FROM `check-subscribes-db`.subscribes ORDER BY idsubscribes DESC LIMIT 1";
export const selectByDate = "SELECT * FROM subscribes WHERE date=?";
export const insertSubscribes =
  "INSERT INTO subscribes(date, user_ids) VALUES (?)";
