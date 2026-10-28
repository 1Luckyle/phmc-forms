// src/components/HeaderInfo.js
import React from 'react';

function HeaderInfo({ commitInfo }) {
    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                {commitInfo.date && (
                    <>
                        <span className="version-info">
                            <a href="https://github.com/1Luckyle/phmc-forms/tree/gh-pages" target="_blank" rel="noopener noreferrer">
                                Ce site web a été mis à jour pour la dernière fois le {commitInfo.date} avec la version #{commitInfo.sha}</a>

                        </span>

                        <span className="contact-info">
                            Remerciements à l'équipe du PHMC US pour le développement de l'outil: Alyson Frost sur <a
                                href="http://discord.gg/rrzJ4EeHfK"
                                className="discord-link"
                            >
                                Discord PHMC US <i className="fab fa-discord"></i>
                            </a>❄️❄️
                        </span>
                        <span className="contact-info">
                            Traduction et support côté FR: Luckyle sur <a
                                href="https://discord.gg/Qupn5tWc6H"
                                className="discord-link"
                            >
                                Discord PHMC FR  <i className="fab fa-discord"></i>
                        </a>🩺🩺
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

export default HeaderInfo;
