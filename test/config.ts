require('dotenv').config();
export const tableName = 'test5';
import {
    WORKAROUND_updateAWSConfig,
} from './../src/index';
export const awsConfig = {
    region: 'us-west-2',
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
  
    // region: 'us-east-1',
    // accessKeyId: 'wat',//process.env.AWS_KEY,
    // secretAccessKey: 'yay',//process.env.AWS_SECRET,
    // endpoint: "http://localhost:8000"
}

WORKAROUND_updateAWSConfig(awsConfig, {
    convertEmptyValues: true
});