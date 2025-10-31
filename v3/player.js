// YoDraw Player v1.0 - Complete Standalone Player
(function() {
    'use strict';
    
    let canvas;
    let projectScriptTimers = [];
    let animState = {
        active: true,
        playing: false,
        currentFrame: 1,
        totalFrames: 30,
        fps: 12,
        data: {},
        playInterval: null
    };
    
    // Override setTimeout/setInterval to track them for cleanup
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    
    window.setTimeoutTracked = function(...args) {
        const id = originalSetTimeout.apply(window, args);
        projectScriptTimers.push(id);
        return id;
    };
    
    window.setIntervalTracked = function(...args) {
        const id = originalSetInterval.apply(window, args);
        projectScriptTimers.push(id);
        return id;
    };
    
    // Wait for Fabric.js to load
    function waitForFabric(callback) {
        if (typeof fabric !== 'undefined') {
            callback();
        } else {
            setTimeout(function() { waitForFabric(callback); }, 100);
        }
    }
    
    // Initialize when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            waitForFabric(initPlayer);
        });
    } else {
        waitForFabric(initPlayer);
    }
    
    function initPlayer() {
        // Get project data
        const projectDataEl = document.getElementById('projectData');
        if (!projectDataEl) {
            showError('No project data found!');
            return;
        }
        
        let projectData;
        try {
            projectData = JSON.parse(projectDataEl.textContent);
        } catch (e) {
            showError('Invalid project data: ' + e.message);
            return;
        }
        
        // Initialize canvas
        const canvasEl = document.getElementById('canvas');
        if (!canvasEl) {
            showError('Canvas element not found!');
            return;
        }
        
        canvas = new fabric.Canvas('canvas', {
            width: projectData.canvasWidth || 800,
            height: projectData.canvasHeight || 600,
            backgroundColor: projectData.canvasBackground || '#ffffff',
            selection: false,
            renderOnAddRemove: false
        });
        
        // Disable all interaction
        canvas.interactive = false;
        canvas.selection = false;
        canvas.hoverCursor = 'default';
        canvas.defaultCursor = 'default';
        canvas.isDrawingMode = false;
        
        // Load canvas objects
        canvas.loadFromJSON(projectData.canvas, function() {
            // Make all objects non-interactive
            canvas.getObjects().forEach(function(obj) {
                obj.selectable = false;
                obj.evented = false;
                obj.hasControls = false;
                obj.hasBorders = false;
                obj.lockMovementX = true;
                obj.lockMovementY = true;
                obj.lockRotation = true;
                obj.lockScalingX = true;
                obj.lockScalingY = true;
                obj.hoverCursor = 'default';
            });
            
            // Set up animation
            if (projectData.animation) {
                animState.totalFrames = projectData.animation.totalFrames || 30;
                animState.fps = projectData.animation.fps || 12;
                animState.data = projectData.animation.data || {};
            }
            
            canvas.renderAll();
            
            // Hide loading screen
            setTimeout(function() {
                const loading = document.getElementById('loadingScreen');
                if (loading) {
                    loading.classList.add('hidden');
                    setTimeout(function() {
                        loading.style.display = 'none';
                    }, 500);
                }
            }, 300);
            
            // Execute project script FIRST
            if (projectData.projectScript) {
                setTimeout(function() {
                    executeProjectScript(projectData.projectScript);
                }, 500);
            }
            
            // Auto-play animation AFTER script
            setTimeout(function() {
                playAnimation();
            }, 800);
        });
    }
    
    function executeProjectScript(scriptCode) {
        try {
            // Create function with ALL necessary globals
            const scriptFunction = new Function(
                'canvas',
                'getObjectById',
                'getObjectsByClass',
                'getObjectsByIds',
                'getObjectsByClasses',
                'getObjectsByAllClasses',
                'setTimeoutTracked',
                'setIntervalTracked',
                scriptCode
            );
            
            // Execute with helper functions
            scriptFunction.call(
                window,
                canvas,
                getObjectById,
                getObjectsByClass,
                getObjectsByIds,
                getObjectsByClasses,
                getObjectsByAllClasses,
                window.setTimeoutTracked,
                window.setIntervalTracked
            );
        } catch (e) {
            console.error('Script error:', e);
        }
    }
    
    // Helper functions
    function getObjectById(id) {
        if (!id || !canvas) return null;
        return canvas.getObjects().find(function(obj) {
            return obj.customId === id;
        }) || null;
    }
    
    function getObjectsByIds(ids) {
        if (!Array.isArray(ids)) return [];
        return ids.map(function(id) {
            return getObjectById(id);
        }).filter(function(obj) {
            return obj !== null;
        });
    }
    
    function objectHasClass(obj, className) {
        return obj && obj.customClasses && obj.customClasses.indexOf(className) !== -1;
    }
    
    function getObjectsByClass(className) {
        if (!className || !canvas) return [];
        return canvas.getObjects().filter(function(obj) {
            return objectHasClass(obj, className);
        });
    }
    
    function getObjectsByClasses(classNames) {
        if (!Array.isArray(classNames) || !canvas) return [];
        return canvas.getObjects().filter(function(obj) {
            return obj.customClasses && obj.customClasses.some(function(c) {
                return classNames.indexOf(c) !== -1;
            });
        });
    }
    
    function getObjectsByAllClasses(classNames) {
        if (!Array.isArray(classNames) || !canvas) return [];
        return canvas.getObjects().filter(function(obj) {
            return obj.customClasses && classNames.every(function(c) {
                return obj.customClasses.indexOf(c) !== -1;
            });
        });
    }
    
    // Animation
    function playAnimation() {
        if (animState.playing || !canvas) return;
        
        animState.playing = true;
        const frameTime = 1000 / animState.fps;
        
        function playNextFrame() {
            if (!animState.playing) return;
            
            let nextFrame = animState.currentFrame + 1;
            if (nextFrame > animState.totalFrames) {
                nextFrame = 1;
            }
            
            goToFrame(nextFrame);
            
            if (animState.playing) {
                setTimeout(playNextFrame, frameTime);
            }
        }
        
        playNextFrame();
    }
    
    function goToFrame(frameNum) {
        if (!canvas) return;
        
        frameNum = Math.max(1, Math.min(animState.totalFrames, parseInt(frameNum) || 1));
        animState.currentFrame = frameNum;
        
        canvas.getObjects().forEach(function(obj) {
            const objId = obj.animId;
            const objData = animState.data[objId];
            
            if (!objData || Object.keys(objData).length === 0) return;
            
            const frames = Object.keys(objData).map(Number).sort(function(a, b) {
                return a - b;
            });
            
            if (objData[frameNum]) {
                applyPropsToObject(obj, objData[frameNum].props);
                return;
            }
            
            let prevFrame = null;
            let nextFrame = null;
            
            for (let i = 0; i < frames.length; i++) {
                const f = frames[i];
                if (f < frameNum) prevFrame = f;
                if (f > frameNum && nextFrame === null) nextFrame = f;
            }
            
            if (prevFrame !== null && nextFrame !== null) {
                const progress = (frameNum - prevFrame) / (nextFrame - prevFrame);
                const interpolated = interpolateProperties(objData[prevFrame], objData[nextFrame], progress);
                applyPropsToObject(obj, interpolated);
            } else if (prevFrame !== null) {
                applyPropsToObject(obj, objData[prevFrame].props);
            } else if (nextFrame !== null) {
                applyPropsToObject(obj, objData[nextFrame].props);
            }
        });
        
        canvas.renderAll();
    }
    
    function applyPropsToObject(obj, props) {
        if (!obj || !props) return;
        try {
            obj.set(props);
            obj.setCoords();
        } catch (e) {
            console.warn('Property error:', e);
        }
    }
    
    function interpolateProperties(startFrame, endFrame, progress) {
        if (!startFrame || !endFrame) return endFrame || startFrame;
        
        const startProps = startFrame.props;
        const endProps = endFrame.props;
        const useSmooth = endFrame.smooth !== false;
        
        if (!useSmooth) {
            return progress >= 1 ? endProps : startProps;
        }
        
        const interpolated = {};
        
        for (const key in endProps) {
            const start = startProps[key];
            const end = endProps[key];
            
            if (typeof end === 'number' && typeof start === 'number') {
                interpolated[key] = start + (end - start) * progress;
            } else if (key === 'shadow' && typeof end === 'object' && typeof start === 'object' && end && start) {
                interpolated[key] = {
                    color: progress > 0.5 ? end.color : start.color,
                    blur: start.blur + (end.blur - start.blur) * progress,
                    offsetX: start.offsetX + (end.offsetX - start.offsetX) * progress,
                    offsetY: start.offsetY + (end.offsetY - start.offsetY) * progress
                };
            } else if (Array.isArray(end) && Array.isArray(start) && end.length === start.length) {
                interpolated[key] = end.map(function(val, i) {
                    if (typeof val === 'number' && typeof start[i] === 'number') {
                        return start[i] + (val - start[i]) * progress;
                    }
                    return progress > 0.5 ? val : start[i];
                });
            } else {
                interpolated[key] = progress > 0.5 ? end : start;
            }
        }
        
        return interpolated;
    }
    
    function showError(message) {
        const loading = document.getElementById('loadingScreen');
        if (loading) {
            loading.innerHTML = '<div style="color: #ff4444; text-align: center; padding: 20px;"><h2>Error</h2><p>' + message + '</p></div>';
        }
    }
    
    function stopProjectScript() {
        projectScriptTimers.forEach(function(id) {
            clearTimeout(id);
            clearInterval(id);
        });
        projectScriptTimers = [];
    }
    
    // Expose API
    window.yoDrawPlayer = {
        canvas: function() { return canvas; },
        play: playAnimation,
        goToFrame: goToFrame,
        getObjectById: getObjectById,
        getObjectsByClass: getObjectsByClass,
        stop: stopProjectScript
    };
    
})();