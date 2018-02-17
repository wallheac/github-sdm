import { Configuration } from "@atomist/automation-client/configuration";
import * as appRoot from "app-root-path";
import { HelloWorld } from "./handlers/commands/HelloWorld";
import { applyHttpServicePhases } from "./software-delivery-machine/blueprint/phase/phaseManagement";
import { affirmationEditor } from "./software-delivery-machine/commands/editors/affirmationEditor";
import { breakBuildEditor, unbreakBuildEditor } from "./software-delivery-machine/commands/editors/breakBuild";
import { MyBlueprint } from "./software-delivery-machine/MyBlueprint";

// tslint:disable-next-line:no-var-requires
const pj = require(`${appRoot.path}/package.json`);

const token = process.env.GITHUB_TOKEN;

const blueprint = new MyBlueprint();

export const configuration: Configuration = {
    name: pj.name,
    version: pj.version,
    teamIds: ["T5964N9B7"], // <-- run @atomist pwd in your slack team to obtain the team id
    commands: blueprint.commandHandlers.concat([
        HelloWorld,
        () => affirmationEditor,
        () => applyHttpServicePhases,
        () => breakBuildEditor,
        () => unbreakBuildEditor,
    ]),
    events: blueprint.eventHandlers.concat([]),
    token,
    http: {
        enabled: true,
        auth: {
            basic: {
                enabled: false,
            },
            bearer: {
                enabled: false,
            },
        },
    },
};
