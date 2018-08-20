"""
Makes amwager ticket ready for visualization 
using the Sankey diagriams developed by Robin Howlett.
The source code for his visualizations can be found at
https://github.com/robinhowlett/visualizing-horizontal-wagers-d3-sankey

Usage: python ticket-to-wager-data.py amwager_ticket_file.csv

@author: Matt Robinson, matthew67robinson@gmail.com 
"""

import sys

ticket_csv_filename = sys.argv[1]

with open(ticket_csv_filename,'r') as ticket_file:
    ticket_data = ticket_file.readlines()

individual_tickets_list = [] # this will be a list of lists
for line in ticket_data:
    fields_list = line.split(',')
    for field in fields_list:
        if '/' in field:
            legs_pns_list = field.strip('"').split('/')
            individual_tickets_list.append(legs_pns_list)

unique_runners_dict = dict.fromkeys(range(1,len(individual_tickets_list[0])+1),[])
json_flow_strings_list = []
json_node_strings_list = []
                                
for ticket in individual_tickets_list:

    for key, runner in enumerate(ticket,1):
        old_runners_list = unique_runners_dict[key]
        if runner not in old_runners_list:
            new_runners_list = old_runners_list + [runner]
            unique_runners_dict[key] = new_runners_list
            
    flow_string = f"{{\"thru\": [\"R1#{ticket[0]}\",\"R2#{ticket[1]}\",\"R3#{ticket[2]}\",\"R4#{ticket[3]}\",\"R5#{ticket[4]}\"],\"value\": 1}},"
    json_flow_strings_list.append(flow_string)
    
for race in unique_runners_dict:
    for pn in unique_runners_dict[race]:
        
        node_string = f"{{\"disp\":\"#{pn}\", \"name\":\"R{race}#{pn}\"}},"
        json_node_strings_list.append(node_string)
        
final_file_string = \
'''
{
  "nodes": [
'''
    
for idx, node_string in enumerate(json_node_strings_list,1):
    
    if idx == len(json_node_strings_list):
        node_string = node_string.strip(',')
        final_file_string += node_string
    else:
        final_file_string += node_string + '\n'

final_file_string += \
'''
  ],
  "flows": [
'''

for idx, flow_string in enumerate(json_flow_strings_list,1):
    
    if idx == len(json_flow_strings_list):
        flow_string = flow_string.strip(',')
        final_file_string += flow_string
    else:
        final_file_string += flow_string + '\n'
    
final_file_string += \
'''
    ]
}
'''

with open("test_json_file.json","w") as f:
    f.write(final_file_string)

with open("./index.html",'r') as f:
    html_data = f.readlines()

num_tickets = len(individual_tickets_list)
total_price = num_tickets*0.5

for idx,line in enumerate(html_data):
    if "PK5 Visualization" in line:
        html_data[idx] = f"<p style=\"text-align:center;margin-top:35px;margin-bottom:15px\">PK5 Visualization. {num_tickets} TIX. ${total_price} </p>"

with open("./index.html",'w') as f:
    f.writelines(html_data)









