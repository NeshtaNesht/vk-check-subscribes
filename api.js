import _ from "lodash";

export const getVkData = (method, body, access_token, user_id) => {
  if (!user_id || !access_token)
    return new Error("user_id or access_token not defined");
  const formData = new FormData();
  for (const key in body) {
    formData.append(key, body[key]);
  }
  formData.append("user_id", user_id);
  formData.append("v", 5.199);
  return fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: {
      Authorization: `${access_token}`,
    },
    body: formData,
  });
};

export const getTokenAuth = (request) => request.headers.authorization;
export const getUserId = (request) => _.get(request, "headers.user_id");
