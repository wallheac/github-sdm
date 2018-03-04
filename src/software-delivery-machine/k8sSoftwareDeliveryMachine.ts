import { SoftwareDeliveryMachine } from "../blueprint/SoftwareDeliveryMachine";
import { GuardedPhaseCreator } from "../common/listener/support/GuardedPhaseCreator";
import { HasK8Spec } from "../common/listener/support/k8sSpecPushTest";
import { MaterialChangeToJavaRepo } from "../common/listener/support/materialChangeToJavaRepo";
import { IsNode } from "../common/listener/support/nodeGuards";
import { PushesToDefaultBranch, PushToPublicRepo } from "../common/listener/support/pushTests";
import { HttpServicePhases, LocalDeploymentPhases } from "../handlers/events/delivery/phases/httpServicePhases";
import { LibraryPhases } from "../handlers/events/delivery/phases/libraryPhases";
import { NpmPhases } from "../handlers/events/delivery/phases/npmPhases";
import { K8sBuildOnSuccessStatus } from "./blueprint/build/K8sBuildOnScanSuccess";
import {
    K8sProductionDeployOnSuccessStatus, K8sStagingDeployOnSuccessStatus, NoticeK8sProdDeployCompletion,
    NoticeK8sTestDeployCompletion,
} from "./blueprint/deploy/k8sDeploy";
import { suggestAddingK8sSpec } from "./blueprint/repo/suggestAddingK8sSpec";
import { addK8sSpec } from "./commands/editors/k8s/addK8sSpec";
import { configureSpringSdm } from "./springSdmConfig";
import { IsMaven, IsSpringBoot } from "../common/listener/support/jvmGuards";

export function k8sSoftwareDeliveryMachine(opts: { useCheckstyle: boolean }): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        {
            builder: K8sBuildOnSuccessStatus,
            deployers: [
                K8sStagingDeployOnSuccessStatus,
                K8sProductionDeployOnSuccessStatus,
            ],
        },
        new GuardedPhaseCreator(HttpServicePhases, IsMaven, HasK8Spec, PushesToDefaultBranch, PushToPublicRepo),
        new GuardedPhaseCreator(NpmPhases, IsNode),
        new GuardedPhaseCreator(LibraryPhases, IsMaven, PushesToDefaultBranch));
    sdm.addNewRepoWithCodeActions(suggestAddingK8sSpec);
    sdm.addSupportingCommands(() => addK8sSpec);
    sdm.addSupportingEvents(() => NoticeK8sTestDeployCompletion,
        () => NoticeK8sProdDeployCompletion);
    configureSpringSdm(sdm, opts);
    return sdm;
}
