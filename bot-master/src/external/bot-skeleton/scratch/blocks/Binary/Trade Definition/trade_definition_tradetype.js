import { localize } from '@deriv-com/translations';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.trade_definition_tradetype = {
    init() {
        this.jsonInit({
            message0: localize('Trade Type: {{ trade_type_category }} > {{ trade_type }}', {
                trade_type_category: '%1',
                trade_type: '%2',
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'TRADETYPECAT_LIST',
                    options: [
                        [localize('Up/Down'), 'callput'],
                        [localize('Touch/No Touch'), 'touchnotouch'],
                        [localize('In/Out'), 'inout'],
                        [localize('Asians'), 'asian'],
                        [localize('Digits'), 'digits'],
                        [localize('Reset Call/Reset Put'), 'reset'],
                        [localize('Call Spread/Put Spread'), 'callputspread'],
                        [localize('High/Low Ticks'), 'highlowticks'],
                        [localize('Only Ups/Only Downs'), 'runs'],
                        [localize('Lookbacks'), 'lookback'],
                        [localize('Multipliers'), 'multiplier'],
                        [localize('Accumulators'), 'accumulator'],
                    ],
                },
                {
                    type: 'field_dropdown',
                    name: 'TRADETYPE_LIST',
                    options: [
                        [localize('Rise/Fall'), 'callput'],
                        [localize('Rise Equals/Fall Equals'), 'callputequal'],
                        [localize('Higher/Lower'), 'higherlower'],
                    ],
                },
            ],
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            previousStatement: null,
            nextStatement: null,
        });
        this.setMovable(false);
        this.setDeletable(false);
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    enforceLimitations: window.Blockly.Blocks.trade_definition_market.enforceLimitations,
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.trade_definition_tradetype = () => {};
