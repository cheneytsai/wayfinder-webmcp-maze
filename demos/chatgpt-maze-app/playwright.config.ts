import {defineConfig} from '@playwright/test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export default defineConfig({testDir:'tests/e2e',timeout:30000,fullyParallel:false,use:{baseURL:'http://127.0.0.1:8790',headless:true,screenshot:'only-on-failure'},webServer:{command:'npm start',url:'http://127.0.0.1:8790/health',env:{PORT:'8790',DB_PATH:join(tmpdir(),`wayfinder-e2e-${process.pid}.sqlite`)},reuseExistingServer:!process.env.CI},reporter:[['list'],['html',{open:'never'}]]});
