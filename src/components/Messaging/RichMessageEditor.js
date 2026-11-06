// src/components/Messaging/RichMessageEditor.js
//
// Éditeur visuel du message (gras, italique, listes, citation, lien, images, couleur…), sans BBCode à connaître : le texte est mis en
// forme directement, et converti en BBCode à chaque modification (utils/internalMail.js : htmlToBbcode) pour que l'aperçu, le PDF,
// l'image PNG et le HTML du site fonctionnent comme pour les autres rapports.
// Images : bouton, glisser-déposer ou collage (Ctrl+V) ; elles sont envoyées sur nos serveurs d'images puis insérées dans le texte.
// Le texte collé est toujours collé SANS mise en forme (aucune police ni couleur importée d'ailleurs).
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Spinner } from 'react-bootstrap';
import { htmlToBbcode } from '../../utils/internalMail';
import { uploadImageToServer } from '../../utils/imageUploadApi';
import './MessagingModal.css';

const COLORS = [
    { value: '#e6edf3', label: 'Blanc' }, { value: '#ff7b72', label: 'Rouge' }, { value: '#ffa657', label: 'Orange' },
    { value: '#e3b341', label: 'Jaune' }, { value: '#3fb950', label: 'Vert' }, { value: '#58a6ff', label: 'Bleu' }, { value: '#d2a8ff', label: 'Violet' },
];

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('lecture du fichier impossible'));
    reader.readAsDataURL(file);
});

// ref : { focus(), clear(), setHtml(html), getHtml(), getBbcode() }
const RichMessageEditor = forwardRef(({ initialHtml = '', onChange, onNotify, disabled = false, minHeight = 220 }, ref) => {
    const editorRef = useRef(null);
    const [uploading, setUploading] = useState(0);
    const [showColors, setShowColors] = useState(false);
    const notify = onNotify || (() => {});

    const emit = useCallback(() => {
        if (editorRef.current && onChange) onChange(htmlToBbcode(editorRef.current), editorRef.current.innerHTML);
    }, [onChange]);

    useImperativeHandle(ref, () => ({
        focus: () => editorRef.current && editorRef.current.focus(),
        clear: () => { if (editorRef.current) { editorRef.current.innerHTML = ''; emit(); } },
        setHtml: (html) => { if (editorRef.current) { editorRef.current.innerHTML = html || ''; emit(); } },
        getHtml: () => (editorRef.current ? editorRef.current.innerHTML : ''),
        getBbcode: () => (editorRef.current ? htmlToBbcode(editorRef.current) : ''),
    }), [emit]);

    useEffect(() => {
        if (editorRef.current && initialHtml) { editorRef.current.innerHTML = initialHtml; emit(); }
        // Une seule fois au montage : le contenu appartient ensuite à l'éditeur.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = (command, value = null) => {
        if (disabled) return;
        if (editorRef.current) editorRef.current.focus();
        // eslint-disable-next-line no-restricted-globals
        document.execCommand(command, false, value);
        emit();
    };

    // Position du curseur dans le texte, mémorisée avant l'ouverture du sélecteur de fichier (qui fait perdre le curseur).
    const savedRange = useRef(null);
    const rememberCaret = () => {
        const selection = window.getSelection();
        savedRange.current = selection && selection.rangeCount > 0 && editorRef.current && editorRef.current.contains(selection.anchorNode)
            ? selection.getRangeAt(0).cloneRange() : null;
    };
    const restoreCaret = () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const selection = window.getSelection();
        if (savedRange.current && editor.contains(savedRange.current.startContainer)) {
            selection.removeAllRanges();
            selection.addRange(savedRange.current);
        } else {
            // Pas de curseur connu : à la fin du message.
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    // Efface la mise en forme de la sélection ; sans sélection, de tout le message (texte, listes, citations, liens, tailles, couleurs).
    const clearFormatting = () => {
        const editor = editorRef.current;
        if (disabled || !editor) return;
        editor.focus();
        const selection = window.getSelection();
        const inside = selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode);
        const wholeMessage = !inside || selection.isCollapsed;
        if (wholeMessage) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList');
        if (document.queryCommandState('insertOrderedList')) document.execCommand('insertOrderedList');
        document.execCommand('formatBlock', false, 'div');
        document.execCommand('removeFormat');
        document.execCommand('unlink');
        if (wholeMessage) selection.collapseToEnd();
        emit();
        notify(wholeMessage
            ? 'Mise en forme effacée sur tout le message. Pour n\'effacer qu\'un passage, sélectionnez-le d\'abord.'
            : 'Mise en forme effacée sur le texte sélectionné.', 'check-circle');
    };

    const insertImageFile = async (file) => {
        if (!file || !/^image\//i.test(file.type)) { notify('Ce fichier n\'est pas une image.', 'warning'); return; }
        setUploading((n) => n + 1);
        try {
            const dataUrl = await fileToDataUrl(file);
            const { url } = await uploadImageToServer(dataUrl);
            restoreCaret();
            document.execCommand('insertImage', false, url);
            savedRange.current = null;
            emit();
        } catch (error) {
            notify(`Image non envoyée : ${error.message || 'erreur inconnue'}`, 'error', 8000);
        } finally {
            setUploading((n) => n - 1);
        }
    };

    const handlePaste = (event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((file) => /^image\//i.test(file.type));
        if (files.length) { event.preventDefault(); rememberCaret(); files.forEach(insertImageFile); return; }
        // Texte seul : pas de mise en forme importée.
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') || '';
        if (text) { document.execCommand('insertText', false, text); emit(); }
    };

    const handleDrop = (event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => /^image\//i.test(file.type));
        if (files.length) { event.preventDefault(); rememberCaret(); files.forEach(insertImageFile); }
    };

    const pickImage = () => {
        rememberCaret();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = () => Array.from(input.files || []).forEach(insertImageFile);
        input.click();
    };

    const addLink = () => {
        const url = window.prompt('Adresse du lien (https://…)');
        if (!url) return;
        if (!/^https?:\/\//i.test(url.trim())) { notify('Le lien doit commencer par https:// ou http://.', 'warning'); return; }
        const selection = window.getSelection();
        if (selection && selection.isCollapsed) document.execCommand('insertHTML', false, `<a href="${url.trim().replace(/"/g, '')}">${url.trim().replace(/[<>&"]/g, '')}</a>`);
        else document.execCommand('createLink', false, url.trim());
        emit();
    };

    const tools = [
        { icon: 'fa-bold', title: 'Gras', action: () => run('bold') },
        { icon: 'fa-italic', title: 'Italique', action: () => run('italic') },
        { icon: 'fa-underline', title: 'Souligné', action: () => run('underline') },
        { icon: 'fa-strikethrough', title: 'Barré', action: () => run('strikeThrough') },
        { sep: true },
        { icon: 'fa-heading', title: 'Titre (texte agrandi)', action: () => run('fontSize', '5') },
        { icon: 'fa-text-height', title: 'Taille normale', action: () => run('fontSize', '3') },
        { icon: 'fa-palette', title: 'Couleur du texte', action: () => setShowColors((open) => !open) },
        { sep: true },
        { icon: 'fa-list-ul', title: 'Liste à puces', action: () => run('insertUnorderedList') },
        { icon: 'fa-list-ol', title: 'Liste numérotée', action: () => run('insertOrderedList') },
        { icon: 'fa-quote-right', title: 'Citation', action: () => run('formatBlock', 'blockquote') },
        { icon: 'fa-minus', title: 'Ligne de séparation', action: () => run('insertHorizontalRule') },
        { sep: true },
        { icon: 'fa-link', title: 'Insérer un lien', action: addLink },
        { icon: 'fa-image', title: 'Insérer une image à l\'endroit du curseur (vous pouvez aussi la coller avec Ctrl+V ou la glisser dans le texte)', action: pickImage },
        { sep: true },
        { icon: 'fa-eraser', title: 'Effacer la mise en forme : du texte sélectionné, ou de tout le message si rien n\'est sélectionné', action: clearFormatting },
    ];

    return (
        <div className={`mm-editor${disabled ? ' is-disabled' : ''}`}>
            <div className="mm-toolbar" role="toolbar" aria-label="Mise en forme">
                {tools.map((tool, index) => (tool.sep
                    ? <span key={`s${index}`} className="mm-toolbar-sep" />
                    : (
                        <button key={tool.icon} type="button" className="mm-tool" title={tool.title} aria-label={tool.title}
                            onMouseDown={(event) => event.preventDefault()} onClick={tool.action} disabled={disabled}>
                            <i className={`fas ${tool.icon}`}></i>
                        </button>
                    )))}
                {uploading > 0 && <span className="mm-uploading"><Spinner animation="border" size="sm" /> Envoi de l'image…</span>}
            </div>
            {showColors && (
                <div className="mm-colors">
                    {COLORS.map((color) => (
                        <button key={color.value} type="button" className="mm-color" title={color.label} style={{ background: color.value }}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => { run('foreColor', color.value); setShowColors(false); }} />
                    ))}
                </div>
            )}
            <div
                ref={editorRef}
                className="mm-editable"
                contentEditable={!disabled}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Texte du message"
                data-placeholder="Écrivez votre message ici…"
                style={{ minHeight }}
                onInput={emit}
                onBlur={emit}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(event) => { if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault(); }}
            />
        </div>
    );
});

export default RichMessageEditor;
