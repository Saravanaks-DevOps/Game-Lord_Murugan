// Third-person controller for Murugan: ground locomotion over the terrain
// height field, peacock flight, orbit camera and the returning Vel.
import * as THREE from 'three';
import { createVel } from '../world/characters.js';
import { clamp, lerp } from './noise.js';

export class Player {
  constructor({ rig, scene, camera, input, heightAt, audio, bursts, bounds = 190, mount = null }) {
    this.rig = rig; this.scene = scene; this.camera = camera; this.input = input; this.audio = audio; this.bursts = bursts;
    this.heightAt = heightAt; this.bounds = bounds;
    this.group = rig.group;
    scene.add(this.group);
    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.camYaw = Math.PI; this.camPitch = 0.28; this.camDist = 7;
    this.grounded = true;
    this.mode = 'ground'; // 'ground' | 'fly' | 'cinematic'
    this.mount = mount;   // peacock rig for flight chapters
    this.flySpeed = 0;
    this.health = 1;
    this.velReady = true; this.velTimer = 0; this.throwAnim = -1;
    this.vel3 = createVel({ length: 2.4 });
    this.vel3.rotation.x = Math.PI / 2 + 0.2; this.vel3.position.set(0, 0, 0.1);
    this.rig.joints.socket.add(this.vel3);
    this.projectiles = [];
    this.frozen = false;
    this.onThrow = null;
    this.walkSpeed = 6.5; this.runSpeed = 11;
    this.canThrow = true;
    this.lookTarget = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
  }

  setPosition(x, z, y = null) {
    this.pos.set(x, y ?? this.heightAt(x, z), z);
  }

  setMode(m) {
    this.mode = m;
    if (m === 'fly' && this.mount) {
      this.mount.group.visible = true;
      this.mount.saddle.add(this.group);
      this.group.position.set(0, 0, 0); this.group.rotation.set(0, 0, 0);
      this.scene.add(this.mount.group);
      this.pos = this.mount.group.position;
      this.camDist = 12;
    }
  }

  throwVel() {
    if (!this.velReady || !this.canThrow) return false;
    this.velReady = false; this.velTimer = 0; this.throwAnim = 0;
    this.audio.whoosh();
    // spawn projectile in facing direction with slight upward arc, guided towards aim
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mode === 'fly' ? this.mount.group.rotation.y : this.yaw);
    const camDir = new THREE.Vector3(); this.camera.getWorldDirection(camDir);
    dir.lerp(camDir.setY(camDir.y * 0.5), 0.5).normalize();
    const p = createVel({ length: 2.4 });
    const start = new THREE.Vector3(); this.vel3.getWorldPosition(start);
    p.position.copy(start);
    this.scene.add(p);
    const light = new THREE.PointLight(0xffb040, 8, 10); p.add(light); light.position.y = 2.2;
    this.projectiles.push({ mesh: p, vel: dir.multiplyScalar(38), life: 2.2, returning: false, hit: false });
    this.vel3.visible = false;
    if (this.onThrow) this.onThrow();
    return true;
  }

  /** Test projectiles against targets [{pos, radius, onHit}]. */
  updateProjectiles(dt, targets = []) {
    const handPos = new THREE.Vector3(); this.rig.joints.socket.getWorldPosition(handPos);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (!pr.returning) {
        pr.vel.y -= 4 * dt;
        pr.mesh.position.addScaledVector(pr.vel, dt);
        pr.mesh.lookAt(pr.mesh.position.clone().add(pr.vel)); pr.mesh.rotateX(Math.PI / 2);
        pr.mesh.rotateY(pr.life * 20);
        // ground hit
        const gy = this.heightAt(pr.mesh.position.x, pr.mesh.position.z);
        if (pr.mesh.position.y < gy - 0.2 || pr.life < 1.2) pr.returning = true;
        for (const t of targets) {
          if (t.dead) continue;
          if (pr.mesh.position.distanceTo(t.pos) < t.radius) {
            this.bursts.emit(pr.mesh.position, 60, 8, '#ffd070');
            this.audio.hit();
            t.onHit(pr);
            pr.returning = true; pr.hit = true;
            if (t.stopVel) { pr.mesh.position.copy(t.pos); pr.life = 0.2; }
            break;
          }
        }
      } else {
        const d = handPos.clone().sub(pr.mesh.position);
        const dist = d.length();
        pr.mesh.position.addScaledVector(d.normalize(), Math.min(dist, 55 * dt));
        pr.mesh.rotateY(dt * 25);
        if (dist < 1.2) {
          this.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
          this.velReady = true; this.vel3.visible = true;
        }
      }
    }
  }

  damage(amount) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.audio.hurt();
    this.hurtFlash = 0.3;
  }

  update(dt, t, targets = []) {
    const inp = this.input;
    const look = inp.consumeLook();
    if (!this.frozen && this.mode !== 'cinematic') {
      this.camYaw -= look.dx * 0.0032;
      this.camPitch = clamp(this.camPitch + look.dy * 0.0025, -0.5, 1.1);
    }
    if (this.throwAnim >= 0) { this.throwAnim += dt * 3.2; if (this.throwAnim > 1) this.throwAnim = -1; }
    if (inp.fire || inp.justPressed('KeyF')) { if (!this.frozen && this.canThrow) this.throwVel(); }
    this.updateProjectiles(dt, targets);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    if (this.mode === 'ground') this._updateGround(dt, t);
    else if (this.mode === 'fly') this._updateFly(dt, t);
    else this.rig.animate(t, 'idle', 1, { holding: true });
    this._updateCamera(dt);
  }

  _updateGround(dt, t) {
    const ax = this.frozen ? { x: 0, y: 0 } : this.input.axis();
    const run = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const speed = run ? this.runSpeed : this.walkSpeed;
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const move = fwd.multiplyScalar(ax.y).add(right.multiplyScalar(ax.x));
    const moving = move.lengthSq() > 0.001;
    if (moving) {
      const targetYaw = Math.atan2(move.x, move.z);
      let d = targetYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    this.vel.x = lerp(this.vel.x, move.x * speed, Math.min(1, dt * 8));
    this.vel.z = lerp(this.vel.z, move.z * speed, Math.min(1, dt * 8));
    if (this.grounded && !this.frozen && this.input.justPressed('Space')) { this.vel.y = 7.5; this.grounded = false; }
    this.vel.y -= 22 * dt;
    this.pos.x = clamp(this.pos.x + this.vel.x * dt, -this.bounds, this.bounds);
    this.pos.z = clamp(this.pos.z + this.vel.z * dt, -this.bounds, this.bounds);
    this.pos.y += this.vel.y * dt;
    const gy = this.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) { this.pos.y = gy; this.vel.y = 0; this.grounded = true; }
    this.group.rotation.y = this.yaw;
    const mode = this.throwAnim >= 0 ? 'throw' : !this.grounded ? 'fly' : moving ? (run ? 'run' : 'walk') : 'idle';
    this.rig.animate(t, mode, 1, { dt, holding: this.velReady, k: this.throwAnim });
  }

  _updateFly(dt, t) {
    const m = this.mount.group;
    const ax = this.frozen ? { x: 0, y: 0 } : this.input.axis();
    // yaw follows camera + strafe input, forward accelerates
    const targetSpeed = this.frozen ? 0 : 14 + ax.y * 14;
    this.flySpeed = lerp(this.flySpeed, targetSpeed, Math.min(1, dt * 2));
    m.rotation.y -= ax.x * dt * 1.6;
    this.camYaw = lerp(this.camYaw, m.rotation.y + Math.PI, Math.min(1, dt * 3));
    let vy = 0;
    if (!this.frozen) { if (this.input.down('Space')) vy = 9; if (this.input.down('ShiftLeft') || this.input.down('ShiftRight')) vy = -9; }
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), m.rotation.y);
    m.position.addScaledVector(fwd, this.flySpeed * dt);
    m.position.y += vy * dt;
    const gy = this.heightAt(m.position.x, m.position.z) + 2.5;
    if (m.position.y < gy) m.position.y = gy;
    if (m.position.y > 220) m.position.y = 220;
    m.rotation.z = lerp(m.rotation.z, -ax.x * 0.45, Math.min(1, dt * 4));
    m.rotation.x = lerp(m.rotation.x, -vy * 0.03, Math.min(1, dt * 4));
    this.mount.animate(t, 'fly', dt);
    this.rig.animate(t, this.throwAnim >= 0 ? 'throw' : 'fly', 1, { dt, k: this.throwAnim });
  }

  _updateCamera(dt) {
    if (this.mode === 'cinematic') return;
    const target = new THREE.Vector3();
    if (this.mode === 'fly') this.mount.group.getWorldPosition(target); else target.copy(this.pos);
    target.y += this.mode === 'fly' ? 2.2 : 1.6;
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
    const desired = target.clone().add(off);
    // keep camera above terrain
    const gy = this.heightAt(desired.x, desired.z) + 0.8;
    if (desired.y < gy) desired.y = gy;
    if (!this._camInit) { this._camInit = true; this.camera.position.copy(desired); this.lookTarget.copy(target); }
    this.camera.position.lerp(desired, Math.min(1, dt * (this.mode === 'fly' ? 4 : 9)));
    this.lookTarget.lerp(target, Math.min(1, dt * 12));
    this.camera.lookAt(this.lookTarget);
  }
}
