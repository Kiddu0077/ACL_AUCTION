import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuctionStateOrder} from '../lib/realtime/auction-state-order.ts';
const state=(player,second)=>({id:'current',current_player_id:player,updated_at:`2026-01-01T00:00:${String(second).padStart(2,'0')}Z`});
test('old sale clear cannot replace the preview of the next player',()=>{
 const order=createAuctionStateOrder(state('A',1));
 order.broadcast({state:state('B',1),pending:true,syncId:'tab',sequence:3});
 assert.equal(order.database(state(null,2)).current_player_id,'B');
 order.broadcast({state:state('B',3),pending:false,syncId:'tab',sequence:4});
 assert.equal(order.database(state(null,2)).current_player_id,'B');
 assert.equal(order.broadcast({state:state('A',1),pending:true,syncId:'tab',sequence:2}).current_player_id,'B');
});
test('lost confirmation expires the preview so a fresh DB read can recover',()=>{
 let now=0;const order=createAuctionStateOrder(state('A',1),()=>now);
 order.broadcast({state:state('B',1),pending:true,syncId:'tab',sequence:1});
 order.database(state(null,2)); now=8001;
 assert.equal(order.expire(),true);assert.equal(order.get().current_player_id,null);
 assert.equal(order.database(state('C',3)).current_player_id,'C');
});
test('invalid and out-of-order states are ignored',()=>{
 const order=createAuctionStateOrder(state('A',4));
 assert.equal(order.broadcast({state:{id:'wrong',updated_at:'bad'}}).current_player_id,'A');
 assert.equal(order.database(state('B',2)).current_player_id,'A');
});
