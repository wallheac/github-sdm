
import { OnDeployStatus } from "../../../handlers/events/delivery/deploy/OnDeployStatus";

export const NotifyOnDeploy = () => new OnDeployStatus(
    (id, status, ctx) => {
        return ctx.messageClient.addressChannels(`Successful deployment of \`${id.owner}/${id.repo}:${id.sha}\``, "deployments");
    },
);