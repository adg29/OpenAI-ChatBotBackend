const systemMessage = {
  role: "system",
  content:
    "Generate a short story(One or Two liner) based on the input\
    Don't use the input's name in the generated story's name\
    Make sure the generated story isn't on the same time and date\
    Make sure the generated story is in a different genre\
    Make sure the generated story is in a different timeline\
    Provide the output in a json format with Story name, description, date, time, place, coordinate",
};
module.exports = { systemMessage };
