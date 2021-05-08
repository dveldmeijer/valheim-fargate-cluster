#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ValheimServerStack } from '../lib/valheim-server-stack';

let accountResolver = (): string => {
  if (app.node.tryGetContext("aws-account-id")) {
    return app.node.tryGetContext("aws-account-id")
  }

  if (process.env.CDK_DEFAULT_ACCOUNT) {
    return process.env.CDK_DEFAULT_ACCOUNT
  }

  throw new Error('AWS account id not found')
}

let regionResolver = (): string => {
  if (app.node.tryGetContext("aws-region")) {
    return app.node.tryGetContext("aws-region")
  }
  if (process.env.CDK_DEFAULT_REGION) {
    return process.env.CDK_DEFAULT_REGION
  }

  throw new Error('AWS region not found')
}


const app = new cdk.App();
new ValheimServerStack(app, 'ValheimServerStack', {
  env: {
    account: accountResolver(),
    region:  regionResolver()
  }
});
