var template = `
<div>
<a href="https://platform.openai.com/threads/{{response.threadId}}" target="_blank">https://platform.openai.com/threads/{{response.threadId}}</a>
<div>
<img src={{response.assistantResponse.op0}} />
</div>
<div>
<a href={{response.assistantResponse.op0}} target="_blank">{{response.assistantResponse.op0}}</a>
</div>
<h2>{{userInput}}<h2/>
<h3>{{response.assistantResponse.op1}}</h3>
<b>{{response.assistantResponse.op2}}</b>

</div>
`;

function constructVisualizerPayload() {
  var res = pm.response.json();

  return { response: res };
}

pm.visualizer.set(template, constructVisualizerPayload());

pm.test(
  "A threadId, runStatus, imageDescriptionForPosts, and assistantResponse is returned",
  () => {
    pm.expect(pm.response.json()).to.have.property("threadId");
    pm.expect(pm.response.json()).to.have.property("runStatus");
    pm.expect(pm.response.json()).to.have.property("assistantResponse");

    pm.globals.set("threadId", pm.response.json().threadId);
  }
);

pm.test("AssistantResponse.op0 exists", function () {
  pm.expect(pm.response.json().assistantResponse).to.have.property("op0");
});

pm.test("AssistantResponse.op1 exists", function () {
  pm.expect(pm.response.json().assistantResponse).to.have.property("op1");
});

pm.test("AssistantResponse.op2 exists", function () {
  pm.expect(pm.response.json().assistantResponse).to.have.property("op2");
});
