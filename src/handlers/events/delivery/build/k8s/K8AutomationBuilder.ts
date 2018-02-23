import {success} from "@atomist/automation-client";
import {GitHubRepoRef} from "@atomist/automation-client/operations/common/GitHubRepoRef";
import {ProjectOperationCredentials, TokenCredentials} from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import {RemoteRepoRef} from "@atomist/automation-client/operations/common/RepoId";
import {AddressChannels} from "../../../../commands/editors/toclient/addressChannels";
import {createStatus} from "../../../../commands/editors/toclient/ghub";
import { Builder, PushThatTriggersBuild } from "../Builder";

const K8AutomationBuildContext = "build/atomist/k8s";
/**
 * Upon recognizing a plan to create an artifact, send a message to k8-automation to request a build.
 * k8-automation will trigger a build for this commit in Google Container Builder.
 * When that is complete, it will send an ImageLinked event, and that means our artifact has been created.
 *
 * The message to k8-automation takes the form of a pending GitHub status.
 * Its response takes the form of a Build event which we will notice and update the Build phase,
 * and an ImageLink event which we will notice and update the Artifact phase with a link to that image.
 */
export class K8sAutomationBuilder implements Builder {
    initiateBuild(creds: ProjectOperationCredentials, id: RemoteRepoRef, ac: AddressChannels, team: string, push: PushThatTriggersBuild): Promise<any> {
        // someday we will do this with a "requested" build node but use a status for now.
        return createStatus((creds as TokenCredentials).token, id as GitHubRepoRef, {
            context: K8AutomationBuildContext + "/" + push.branch,
            state: "pending",
            description: "Requested build in k8-automation",
            target_url: undefined,
        }).then(success);
    }
}